// AWS Lambda entry (Node.js 22, function URL, AuthType NONE; the bearer check is in blshSigner.mjs).
// Not executed by the local proof (no AWS). The AWS SDK v3 clients ship with the Lambda Node.js 22 runtime.
// Configuration (Lambda environment, set by TJ in the AWS console):
//   BLSH_SIGNER_MANDATE       JSON mandate (TJ's approval record, non-secret)
//   BLSH_SIGNER_TRIGGER_SECRET  >= 32 chars, same value as Supabase Vault secret blsh_signer_trigger_secret (not a signing key)
//   BLSH_SIGNER_LEDGER_TABLE  DynamoDB table name (blsh-signer-issuance)
import { KMSClient, GetPublicKeyCommand, SignCommand } from "@aws-sdk/client-kms";
import { DynamoDBClient, PutItemCommand, UpdateItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { createSigner } from "./blshSigner.mjs";

const kmsClient = new KMSClient({}), ddb = new DynamoDBClient({});
const table = () => process.env.BLSH_SIGNER_LEDGER_TABLE;
const signer = createSigner({
  mandate: () => JSON.parse(process.env.BLSH_SIGNER_MANDATE ?? "null"),
  now: () => Date.now(),
  triggerSecret: () => process.env.BLSH_SIGNER_TRIGGER_SECRET ?? "",
  kms: {
    getPublicKey: ({ KeyId }) => kmsClient.send(new GetPublicKeyCommand({ KeyId })),
    sign: (input) => kmsClient.send(new SignCommand(input)),
  },
  ledger: {
    async reserve(id, attrs) {
      try {
        await ddb.send(new PutItemCommand({ TableName: table(), ConditionExpression: "attribute_not_exists(slot)",
          Item: { slot: { S: id }, record: { S: JSON.stringify(attrs) } } }));
        return true;
      } catch (e) { if (e?.name === "ConditionalCheckFailedException") return false; throw e; }
    },
    async complete(id, attrs) {
      await ddb.send(new UpdateItemCommand({ TableName: table(), Key: { slot: { S: id } }, ConditionExpression: "attribute_exists(slot)",
        UpdateExpression: "SET #r = :r", ExpressionAttributeNames: { "#r": "record" }, ExpressionAttributeValues: { ":r": { S: JSON.stringify(attrs) } } }));
    },
    async get(id) {
      const out = await ddb.send(new GetItemCommand({ TableName: table(), Key: { slot: { S: id } }, ConsistentRead: true }));
      return out.Item ? JSON.parse(out.Item.record.S) : null;
    },
  },
  async nhlSchedule(date) {
    const res = await fetch(`https://api-web.nhle.com/v1/schedule/${date}`, { redirect: "error", signal: AbortSignal.timeout(5000) });
    if (res.status !== 200) throw new Error("schedule_status");
    return res.json();
  },
  // Decision codes and hashes only. Never the envelope, the evidence body or any header.
  log: (event) => console.log(JSON.stringify(event)),
});

export const handler = async (event) => {
  const headers = Object.fromEntries(Object.entries(event.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const body = event.body == null ? "" : event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  const out = await signer.handle({ method: event.requestContext?.http?.method, path: event.rawPath, rawQuery: event.rawQueryString ?? "", headers, body });
  return { statusCode: out.status, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(out.body) };
};
