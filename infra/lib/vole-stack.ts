import { Duration, Stack, StackProps, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { WebSocketLambdaIntegration, HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

export class VoleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const domain = 'vole.sh';

    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const tokensTable = new dynamodb.Table(this, 'TokensTable', {
      partitionKey: { name: 'tokenId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    tokensTable.addGlobalSecondaryIndex({
      indexName: 'tokenHashIndex',
      partitionKey: { name: 'tokenHash', type: dynamodb.AttributeType.STRING },
    });

    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const tunnelsTable = new dynamodb.Table(this, 'TunnelsTable', {
      partitionKey: { name: 'subdomain', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const logsTable = new dynamodb.Table(this, 'LogsTable', {
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'requestId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const commonEnv = {
      USERS_TABLE: usersTable.tableName,
      TOKENS_TABLE: tokensTable.tableName,
      CONNECTIONS_TABLE: connectionsTable.tableName,
      TUNNELS_TABLE: tunnelsTable.tableName,
      LOGS_TABLE: logsTable.tableName,
    };

    const wsHandler = new lambda.Function(this, 'WsHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      code: lambda.Code.fromAsset('lib/lambdas/ws-handler'),
      handler: 'index.handler',
      environment: commonEnv,
      timeout: Duration.seconds(30),
    });

    const relayHandler = new lambda.Function(this, 'RelayHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      code: lambda.Code.fromAsset('lib/lambdas/relay-handler'),
      handler: 'index.handler',
      environment: commonEnv,
      timeout: Duration.minutes(15),
    });

    const authHandler = new lambda.Function(this, 'AuthHandler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      code: lambda.Code.fromAsset('lib/lambdas/auth-handler'),
      handler: 'index.handler',
      environment: commonEnv,
      timeout: Duration.seconds(30),
    });

    for (const table of [usersTable, tokensTable, connectionsTable, tunnelsTable, logsTable]) {
      table.grantReadWriteData(wsHandler);
      table.grantReadWriteData(relayHandler);
      table.grantReadWriteData(authHandler);
    }

    const webSocketApi = new apigwv2.WebSocketApi(this, 'WebSocketApi', {
      connectRouteOptions: { integration: new WebSocketLambdaIntegration('ConnectIntegration', wsHandler) },
      disconnectRouteOptions: { integration: new WebSocketLambdaIntegration('DisconnectIntegration', wsHandler) },
      defaultRouteOptions: { integration: new WebSocketLambdaIntegration('DefaultIntegration', wsHandler) },
    });

    new apigwv2.WebSocketStage(this, 'WebSocketStage', {
      webSocketApi,
      stageName: 'dev',
      autoDeploy: true,
    });

    webSocketApi.grantManageConnections(wsHandler);

    const relayUrl = new lambda.FunctionUrl(this, 'RelayFunctionUrl', {
      function: relayHandler,
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: { allowedOrigins: ['*'], allowedMethods: [lambda.HttpMethod.ALL] },
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      corsPreflight: { allowOrigins: ['*'], allowMethods: [apigwv2.CorsHttpMethod.ANY] },
      createDefaultStage: false,
    });

    httpApi.addRoutes({
      path: '/health',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('HealthIntegration', authHandler),
    });

    const httpStage = new apigwv2.HttpStage(this, 'HttpStage', {
      httpApi,
      stageName: 'dev',
      autoDeploy: true,
    });

    const uiBucket = new s3.Bucket(this, 'UIBucket', {
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: domain,
      subjectAlternativeNames: [`*.${domain}`],
      validation: acm.CertificateValidation.fromDns(),
    });

    const uiDistribution = new cloudfront.Distribution(this, 'UiDistribution', {
      comment: 'Vole UI',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      certificate,
      domainNames: [domain],
      defaultBehavior: {
        origin: new origins.S3Origin(uiBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    const tunnelDistribution = new cloudfront.Distribution(this, 'TunnelDistribution', {
      comment: 'Vole tunnels',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      certificate,
      domainNames: [`*.${domain}`],
      defaultBehavior: {
        origin: new origins.HttpOrigin(
          relayUrl.url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
          { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY },
        ),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });

    new CfnOutput(this, 'WebSocketUrl', { value: webSocketApi.apiEndpoint });
    new CfnOutput(this, 'HttpApiUrl', { value: httpStage.url });
    new CfnOutput(this, 'RelayUrl', { value: relayUrl.url });
    new CfnOutput(this, 'UIBucketName', { value: uiBucket.bucketName });
    new CfnOutput(this, 'UiDistributionDomain', { value: uiDistribution.distributionDomainName });
    new CfnOutput(this, 'TunnelDistributionDomain', { value: tunnelDistribution.distributionDomainName });
  }
}
