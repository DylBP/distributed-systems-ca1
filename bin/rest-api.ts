#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AuthAppStack } from "../lib/auth-app-stack";

const app = new cdk.App();
new AuthAppStack(app, "RestAPIStack", { env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION } });
