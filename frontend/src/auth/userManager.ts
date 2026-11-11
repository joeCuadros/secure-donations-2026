import { UserManager } from "oidc-client-ts";
import { oidcConfig } from "./authConfig";

export const userManager = new UserManager(oidcConfig);
