import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, QueryCommandInput, UpdateCommand, UpdateCommandInput } from "@aws-sdk/lib-dynamodb";
import { parseCookies, CookieMap } from "./utils";
import { extractUserIdFromJWT } from "../shared/util";
import schema from "../shared/types.schema.json";
import Ajv from "ajv";

const ddbDocClient = createDDbDocClient();

const ajv = new Ajv();
const isValidBodyParams = ajv.compile(schema.definitions["RetroGame"] || {});

export const handler: APIGatewayProxyHandlerV2 = async (event: any, context) => {
    try {
        console.log("[EVENT]", JSON.stringify(event));
        const body = event.body ? JSON.parse(event.body) : undefined;

        const gamePlatform = body.platform
        const title = body.title

        // If body is missing
        if (!body) {
            return {
                statusCode: 400,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "Missing request body" }),
            };
        }

        // If body is present but invalid
        if (!isValidBodyParams(body)) {
            return {
                statusCode: 500,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    message: "Incorrect type. Must match RetroGame schema",
                    schema: schema.definitions["RetroGame"],
                }),
            };
        }

        // Get object currently stored in the database to check userId
        let fetchCommandInput: QueryCommandInput = {
            TableName: process.env.TABLE_NAME,
            KeyConditionExpression: "platform = :platform AND title = :title",
            ExpressionAttributeValues: {
              ":platform": gamePlatform,
              ":title": title
            }
          }

        const commandOutput = await ddbDocClient.send(
            new QueryCommand(fetchCommandInput)
        );

        // If game doesnt exist in the table
        if (!commandOutput.Items || commandOutput.Items.length === 0) {
            return {
              statusCode: 404,
              headers: {
                "content-type": "application/json",
              },
              body: JSON.stringify({ Message: "Game to update not found" }),
            };
          }

        // Check for cookies. Using || {} here as we are checking for the cookie at auth level. Can't get here without token
        // This method shown is parsing the cookie supplied by the user, and then taking out the user ID
        // See /shared/util.ts for how the JTW is being parsed
        const parsedCookies: CookieMap = parseCookies(event) || {}
        const jwtToken = parsedCookies.token

        // get userId from JWT - userId will be valid if code gets to here
        const userId = extractUserIdFromJWT(jwtToken)

        // Perform check to see if userId within the item is the same as the userId making the request
        if (commandOutput.Items[0].userId != userId) {
            return {
                statusCode: 401,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "Can only update a Retro Game that you have added yourself!" }),
            };
        }

        let commandInput: UpdateCommandInput = {
            TableName: process.env.TABLE_NAME,
            Key: {
                platform: gamePlatform,
                title: title
            },
            UpdateExpression: "set #id = :id, #genre = :genre, #release_date = :release_date, #developer = :developer, #publisher = :publisher, #description = :description, #cover_art_path = :cover_art_path, #screenshots = :screenshots, #rating = :rating, #popularity = :popularity, #multiplayer = :multiplayer, #average_score = :average_score, #review_count = :review_count",
            ExpressionAttributeNames: {
                '#id': 'id',
                '#genre': 'genre',
                '#release_date': 'release_date',
                '#developer': 'developer',
                '#publisher': 'publisher',
                '#description': 'description',
                '#cover_art_path': 'cover_art_path',
                '#screenshots': 'screenshots',
                '#rating': 'rating',
                '#popularity': 'popularity',
                '#multiplayer': 'multiplayer',
                '#average_score': 'average_score',
                '#review_count': 'review_count',
            },
            ExpressionAttributeValues: {
                ':id': body.id,
                ':genre': body.genre,
                ':release_date': body.release_date,
                ':developer': body.developer,
                ':publisher': body.publisher,
                ':description': body.description,
                ':cover_art_path': body.cover_art_path,
                ':screenshots': body.screenshots,
                ':rating': body.rating,
                ':popularity': body.popularity,
                ':multiplayer': body.multiplayer,
                ':average_score': body.average_score,
                ':review_count': body.review_count,
            },
            ReturnValues: "ALL_NEW"
        }

        await ddbDocClient.send(
            new UpdateCommand(commandInput)
        );

        return {
            statusCode: 200,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ message: "Retro Game updated" }),
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
}



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