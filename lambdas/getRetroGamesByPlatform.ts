import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { translateJsonCollection } from "../shared/util";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    // Print Event
    console.log("[EVENT]", JSON.stringify(event));

    // Get path parameters
    const parameters = event?.pathParameters;
    const gamePlatform = parameters?.platform ? parameters.platform : undefined;

    // Get Query string
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

    if ("language" in queryString) {
      const targetLanguage = queryString.language || "en";

      let checkCommandInput: QueryCommandInput = {
        TableName: process.env.TRANSLATED_TABLE,
        KeyConditionExpression: "id = :id AND lang = :lang",
        ExpressionAttributeValues: {
          ":id": commandOutput.Items[0].id,
          ":lang": targetLanguage
        }
      }

      const checkDatabaseCommandOutput = await ddbDocClient.send(
        new QueryCommand(checkCommandInput)
      );

      // if there is nothing found in the check database ()
      if (!checkDatabaseCommandOutput.Items || checkDatabaseCommandOutput.Items.length === 0) {
        // immediately translate the text attributes
        const translated = await translateJsonCollection(commandOutput.Items[0], targetLanguage, ["title", "platform"])

        // put the translated thingy into the new table
        const putCommandOutput = await ddbDocClient.send(
          new PutCommand({
            TableName: process.env.TRANSLATED_TABLE,
            Item: translated
          })
        )

        // return response for title, platform not found in translated table (ie. cache miss)
        return {
          statusCode: 200,
          headers: {
            "content-type": "application/json",
            "did-cache-hit": "false"
          },
          body: JSON.stringify(translated),
        }

      }
      
      // return response for title, platform match in translated table (ie. cache hit)
      return {
        statusCode: 200,
        headers: {
          "content-type": "application/json",
          "did-cache-hit": "true"
        },
        body: JSON.stringify(checkDatabaseCommandOutput.Items),
      }

    }

    const body = {
      data: commandOutput.Items,
    };


    // Return Response for no title, no platform, no language
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
