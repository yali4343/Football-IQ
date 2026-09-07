import "dotenv/config";
import "reflect-metadata";

import { container } from "./container.js";
import type { Logger } from "./logging/Logger.js";
import { StartupReporter } from "./startup/StartupReporter.js";

const firstLogger = container.resolve<Logger>("Logger");
const secondLogger = container.resolve<Logger>("Logger");

console.log("Same logger instance:", firstLogger === secondLogger);

const startupMessage = container.resolve<string>("StartupMessage");

console.log(startupMessage);

const startupReporter = container.resolve(StartupReporter);

startupReporter.reportReady();

await import("./server.js");
