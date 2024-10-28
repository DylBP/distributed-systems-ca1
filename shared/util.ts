import { marshall } from "@aws-sdk/util-dynamodb";
import { RetroGame } from "./types";

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
