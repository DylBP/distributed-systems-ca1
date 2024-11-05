import { marshall } from "@aws-sdk/util-dynamodb";
import { RetroGame } from "./types";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { APIGatewayRequestAuthorizerEvent, APIGatewayAuthorizerEvent, PolicyDocument, APIGatewayProxyEvent, StatementEffect } from "aws-lambda";
import axios from "axios"
import jwt from 'jsonwebtoken'
import jwkToPem from "jwk-to-pem";

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


// ----- Auth Code -----

export type CookieMap = { [key: string]: string } | undefined;
export type JwtToken = { sub: string; email: string } | null;
export type Jwk = {
  keys: {
    alg: string;
    e: string;
    kid: string;
    kty: string;
    n: string;
    use: string;
  }[];
};

export const parseCookies = (
  event: APIGatewayRequestAuthorizerEvent | APIGatewayProxyEvent
) => {
  if (!event.headers || !event.headers.Cookie) {
    return undefined;
  }

  const cookiesStr = event.headers.Cookie;
  const cookiesArr = cookiesStr.split(";");

  const cookieMap: CookieMap = {};

  for (let cookie of cookiesArr) {
    const cookieSplit = cookie.trim().split("=");
    cookieMap[cookieSplit[0]] = cookieSplit[1];
  }

  return cookieMap;
};

export const verifyToken = async (
  token: string,
  userPoolId: string | undefined,
  region: string
): Promise<JwtToken> => {
  try {
    const url = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
    const { data }: { data: Jwk } = await axios.get(url);
    const pem = jwkToPem(data.keys[0]);

    return jwt.verify(token, pem, { algorithms: ["RS256"] });
  } catch (err) {
    console.log(err);
    return null;
  }
};

export const createPolicy = (
  event: APIGatewayAuthorizerEvent,
  effect: StatementEffect
): PolicyDocument => {
  return {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: effect,
        Action: "execute-api:Invoke",
        Resource: [event.methodArn],
      },
    ],
  };
};