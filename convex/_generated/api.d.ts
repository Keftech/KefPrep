/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as catalog from "../catalog.js";
import type * as cbt from "../cbt.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_plans from "../lib/plans.js";
import type * as lib_rotation from "../lib/rotation.js";
import type * as lib_types from "../lib/types.js";
import type * as seed from "../seed.js";
import type * as seedData_questions from "../seedData/questions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  catalog: typeof catalog;
  cbt: typeof cbt;
  "lib/auth": typeof lib_auth;
  "lib/plans": typeof lib_plans;
  "lib/rotation": typeof lib_rotation;
  "lib/types": typeof lib_types;
  seed: typeof seed;
  "seedData/questions": typeof seedData_questions;
  users: typeof users;
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
