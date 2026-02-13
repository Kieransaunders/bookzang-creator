/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as books from "../books.js";
import type * as chunkPlanner from "../chunkPlanner.js";
import type * as cleanup from "../cleanup.js";
import type * as cleanupAi from "../cleanupAi.js";
import type * as cleanupAiClient from "../cleanupAiClient.js";
import type * as cleanupAutoResolutions from "../cleanupAutoResolutions.js";
import type * as cleanupChaptering from "../cleanupChaptering.js";
import type * as cleanupDecisionPolicy from "../cleanupDecisionPolicy.js";
import type * as cleanupFlags from "../cleanupFlags.js";
import type * as cleanupPatchApply from "../cleanupPatchApply.js";
import type * as cleanupPipeline from "../cleanupPipeline.js";
import type * as cleanupPrompts from "../cleanupPrompts.js";
import type * as cleanupTelemetry from "../cleanupTelemetry.js";
import type * as copyrightAi from "../copyrightAi.js";
import type * as copyrightParser from "../copyrightParser.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as ingestJobs from "../ingestJobs.js";
import type * as intake from "../intake.js";
import type * as intakeMetadata from "../intakeMetadata.js";
import type * as jobStages from "../jobStages.js";
import type * as jobs from "../jobs.js";
import type * as openrouterRouting from "../openrouterRouting.js";
import type * as router from "../router.js";
import type * as templates from "../templates.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  books: typeof books;
  chunkPlanner: typeof chunkPlanner;
  cleanup: typeof cleanup;
  cleanupAi: typeof cleanupAi;
  cleanupAiClient: typeof cleanupAiClient;
  cleanupAutoResolutions: typeof cleanupAutoResolutions;
  cleanupChaptering: typeof cleanupChaptering;
  cleanupDecisionPolicy: typeof cleanupDecisionPolicy;
  cleanupFlags: typeof cleanupFlags;
  cleanupPatchApply: typeof cleanupPatchApply;
  cleanupPipeline: typeof cleanupPipeline;
  cleanupPrompts: typeof cleanupPrompts;
  cleanupTelemetry: typeof cleanupTelemetry;
  copyrightAi: typeof copyrightAi;
  copyrightParser: typeof copyrightParser;
  files: typeof files;
  http: typeof http;
  ingestJobs: typeof ingestJobs;
  intake: typeof intake;
  intakeMetadata: typeof intakeMetadata;
  jobStages: typeof jobStages;
  jobs: typeof jobs;
  openrouterRouting: typeof openrouterRouting;
  router: typeof router;
  templates: typeof templates;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
