import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import * as apig from "aws-cdk-lib/aws-apigateway"
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import { generateBatch } from "../shared/util";
import { retroGames } from "../seed/games";
import * as iam from "aws-cdk-lib/aws-iam";

type AppApiProps = {
  userPoolId: string
  userPoolClientId: string
}

export class RestAPIStack extends Construct {
  constructor(scope: Construct, id: string, props: AppApiProps) {
    super(scope, id);

    // Tables 
    const retroGamesTable = new dynamodb.Table(this, "RetroGamesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "platform", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "title", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "RetroGames",
    });

    const translatedTable = new dynamodb.Table(this, "TranslatedTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "lang", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "TranslatedTable",
    });

    // CommonProps
    const appCommonFnProps = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
      environment: {
        USER_POOL_ID: props.userPoolId,
        CLIENT_ID: props.userPoolClientId,
        REGION: cdk.Aws.REGION,
        TABLE_NAME: retroGamesTable.tableName
      },
    };

    // Functions 
    const getRetroGamesByPlatformFn = new lambdanode.NodejsFunction(this, "GetRetroGamesByPlatformFn", {
      ...appCommonFnProps,
      entry: "./lambdas/getRetroGamesByPlatform.ts",
      environment: {
        ...appCommonFnProps.environment,
        TRANSLATED_TABLE: translatedTable.tableName
      }
    });

    const getAllRetroGamesFn = new lambdanode.NodejsFunction(this, "GetAllRetroGamesFn", {
      ...appCommonFnProps,
      entry: "./lambdas/getAllRetroGames.ts"
    }
    );

    const updateRetroGameFn = new lambdanode.NodejsFunction(this, "UpdateRetroGameFn", {
      ...appCommonFnProps,
      entry: "./lambdas/updateRetroGame.ts"
    }
    );

    const newRetroGameFn = new lambdanode.NodejsFunction(this, "AddRetroGameFn", {
        ...appCommonFnProps,
        entry: "./lambdas/addRetroGame.ts"
      }
    );

    const authorizerFn = new lambdanode.NodejsFunction(this, "AuthorizerFn", {
      ...appCommonFnProps,
      entry: "./lambdas/auth/authorizer.ts",
    });

    // Auth
    const requestAuthorizer = new apig.RequestAuthorizer(
      this,
      "RequestAuthorizer",
      {
        identitySources: [apig.IdentitySource.header("cookie")],
        handler: authorizerFn,
        resultsCacheTtl: cdk.Duration.minutes(0),
      }
    );

    new custom.AwsCustomResource(this, "retrogamesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [retroGamesTable.tableName]: generateBatch(retroGames),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("retrogamesddbInitData"), //.of(Date.now().toString()),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [retroGamesTable.tableArn],
      }),
    });

    const translatePolicy = new iam.PolicyStatement({
      actions: ["translate:TranslateText"],
      resources: ["*"]
    })

    // Permissions 
    retroGamesTable.grantReadData(getRetroGamesByPlatformFn)
    retroGamesTable.grantReadData(getAllRetroGamesFn)
    retroGamesTable.grantReadWriteData(newRetroGameFn)
    retroGamesTable.grantReadWriteData(updateRetroGameFn)
    translatedTable.grantReadWriteData(getRetroGamesByPlatformFn)

    getRetroGamesByPlatformFn.addToRolePolicy(translatePolicy)

    // REST API
    const api = new apig.RestApi(this, "RestAPI", {
      description: "demo api",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    // GAMES ENDPOINTS ------------------
    const retroGamesEndpoint = api.root.addResource("retroGames");
    retroGamesEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getAllRetroGamesFn, { proxy: true })
    );

    retroGamesEndpoint.addMethod(
      "POST",
      new apig.LambdaIntegration(newRetroGameFn, { proxy: true }), {
        authorizer: requestAuthorizer,
        authorizationType: apig.AuthorizationType.CUSTOM
      }
    )

    retroGamesEndpoint.addMethod(
      "PUT",
      new apig.LambdaIntegration(updateRetroGameFn, { proxy: true }), {
        authorizer: requestAuthorizer,
        authorizationType: apig.AuthorizationType.CUSTOM
      }
    )


    // GAME BY PLATFORM ENDPOINTS ---------
    const retroGameEndpoint = retroGamesEndpoint.addResource("{platform}");
    retroGameEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getRetroGamesByPlatformFn, { proxy: true })
    );

  }
}
