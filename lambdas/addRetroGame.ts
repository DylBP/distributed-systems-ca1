import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";
import * as cookie from 'cookie';
import { extractUserIdFromJWT } from "../shared/util";

const ajv = new Ajv();
const isValidBodyParams = ajv.compile(schema.definitions["RetroGame"] || {});

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event: any, context) => {
    try {
        console.log("[EVENT]", JSON.stringify(event));
        const body = event.body ? JSON.parse(event.body) : undefined;

        // If body missing
        if (!body) {
            return {
                statusCode: 500,
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

        // Check for JWT
        const cookies = event.headers.Cookie || event.headers.cookies
        const parsedCookies = cookies ? cookie.parse(cookies) : {};
        const jwtToken = parsedCookies["token"]

        // If no valid jwtToken is found
        if (!jwtToken) {
            return {
                statusCode: 403,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "Unauthorized: No JWT token" }),
            };
        }

        // Try get userId from JWT
        const userId = extractUserIdFromJWT(jwtToken)

        // If no userId found
        if (!userId) {
            return {
                statusCode: 403,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "Unauthorized: No JWT token" }),
            };
        }

        const item = {
            ...body,
            userId
        }

        const commandOutput = await ddbDocClient.send(
            new PutCommand({
                TableName: process.env.TABLE_NAME,
                Item: item,
            })

        );
        return {
            statusCode: 201,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ message: "Retro Game added" }),
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