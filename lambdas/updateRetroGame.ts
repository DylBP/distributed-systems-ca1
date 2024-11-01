import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, UpdateCommandInput } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();


export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try {
        console.log("[EVENT]", JSON.stringify(event));
        const body = event.body ? JSON.parse(event.body) : undefined;

        const gamePlatform = body.platform
        const title = body.title

        if (!body) {
            return {
                statusCode: 400,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "Missing request body" }),
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