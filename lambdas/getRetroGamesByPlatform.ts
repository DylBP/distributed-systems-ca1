import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    // Print Event
    console.log("[EVENT]", JSON.stringify(event));

    const parameters = event?.pathParameters;
    const gamePlatform = parameters?.platform ? parameters.platform : undefined;
    const queryString = event.queryStringParameters || {};

    if (!gamePlatform) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Missing game platform\n Try '{baseurl}/NES'" }),
      };
    }

    let commandInput: QueryCommandInput = {
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: "platform = :platform",
      ExpressionAttributeValues: {
        ":platform": gamePlatform
      }
    }

    if ("title" in queryString) {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: `${commandInput.KeyConditionExpression} AND title = :title`,
        ExpressionAttributeValues: {
          ...commandInput.ExpressionAttributeValues,
          ":title": queryString.title
        }
      }
    }

    const commandOutput = await ddbDocClient.send(
      new QueryCommand(commandInput)
    );

    console.log("QueryCommand response: ", commandOutput);
    if (!commandOutput.Items || commandOutput.Items.length === 0) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "No games on the specified platform found" }),
      };
    }

    const body = {
      data: commandOutput.Items,
    };


    // Return Response
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    };
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error }),
    };
  }
};

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
