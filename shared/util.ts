import { marshall } from "@aws-sdk/util-dynamodb";
import { RetroGame } from "./types";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { APIGatewayRequestAuthorizerEvent, APIGatewayAuthorizerEvent, PolicyDocument, APIGatewayProxyEvent, StatementEffect } from "aws-lambda";

const translateClient = new TranslateClient({ region: "eu-west-1" })

export const generateRetroGameItem = (retroGame: RetroGame) => {
  return {
    PutRequest: {
      Item: marshall(retroGame),
    },
  };
};

export const generateBatch = (data: RetroGame[]) => {
  return data.map((e) => {
    return generateRetroGameItem(e);
  });
};

export async function translateJsonCollection(data: any, targetLanguageCode: string, excludeList: string[]) {
  const translatedAttributes: any = {}

  for (const attribute in data) {

    if (excludeList.includes(attribute)) {
      translatedAttributes[attribute] = data[attribute]
      continue;
    }

    if (typeof data[attribute] === "string") {
      const command = new TranslateTextCommand({
        Text: data[attribute],
        SourceLanguageCode: "en",
        TargetLanguageCode: targetLanguageCode
      })
      const commandOutput = await translateClient.send(command)
      translatedAttributes[attribute] = commandOutput.TranslatedText
    } else {
      translatedAttributes[attribute] = data[attribute]
    }
  }

  translatedAttributes["lang"] = targetLanguageCode
  return translatedAttributes
}

export function extractUserIdFromJWT(jwt: string): string | null {
  try {
      // Split JWT into three components
      const [header, payload, signature] = jwt.split('.');

      // Base64 decode the payload
      const decodedPayload = Buffer.from(payload, 'base64').toString('utf8');

      // Store the decoded payload in { sub }
      const { sub } = JSON.parse(decodedPayload);

      // Return sub (see jwt.io for more information on how this works - try putting in JWT to see structure)
      return sub || null;
  } catch (err) {
      console.error("Error decoding JWT:", err);
      return null;
  }
}