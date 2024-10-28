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

export class RestAPIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Tables 
    const retroGamesTable = new dynamodb.Table(this, "RetroGamesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "platform", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "release_date", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "RetroGames",
    });

    
    // Functions 
    const getRetroGamesByPlatformFn = new lambdanode.NodejsFunction(
      this,
      "GetRetroGamesByPlatformFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getRetroGamesByPlatform.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: retroGamesTable.tableName,
          REGION: 'eu-west-1',
        },
      }
      );
      
      const getAllRetroGamesFn = new lambdanode.NodejsFunction(
        this,
        "GetAllRetroGamesFn",
        {
          architecture: lambda.Architecture.ARM_64,
          runtime: lambda.Runtime.NODEJS_18_X,
          entry: `${__dirname}/../lambdas/getAllRetroGames.ts`,
          timeout: cdk.Duration.seconds(10),
          memorySize: 128,
          environment: {
            TABLE_NAME: retroGamesTable.tableName,
            REGION: 'eu-west-1',
          },
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
        
        // Permissions 
        retroGamesTable.grantReadData(getRetroGamesByPlatformFn)
        
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
    
        const retroGamesEndpoint = api.root.addResource("retroGames");
        retroGamesEndpoint.addMethod(
          "GET",
          new apig.LambdaIntegration(getAllRetroGamesFn, { proxy: true })
        );
    
        const retroGameEndpoint = retroGamesEndpoint.addResource("{platform}");
        retroGameEndpoint.addMethod(
          "GET",
          new apig.LambdaIntegration(getRetroGamesByPlatformFn, { proxy: true })
        );
      }
    }
    