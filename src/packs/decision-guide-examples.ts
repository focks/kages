// Three unrelated subjects built from the same intake shape. They are the proof that the pack is
// repeatable (the tests build and exercise all three) and the starting point an author copies.
// Figures are illustrative placeholders and none of these is marked verified: a guide ships
// verified only when a person has checked its facts against the sources.
import type { Intake } from "./decision-guide.ts";

export const snowflakeReaderAccounts: Intake = {
  id: "snowflake-reader-accounts-guide", title: "Share Snowflake data with people who don't have Snowflake", subject: "Snowflake · Data sharing",
  reader: "a solutions engineer deciding how to give a customer access", summary: "A reader account lets a consumer query your shared data without owning a Snowflake account, and you pay for their compute.",
  explain: "- You create a managed account of type `READER` and own it.\n- You add it to a share holding the databases, schemas and **secure views** to expose.\n- Its admin creates users, a warehouse and a database from the share.\n- Queries run on the reader account's warehouses, billed to you.\n\nNothing is copied: the consumer queries your live data. Reader accounts are query-only: loading data and creating shares are blocked there.",
  diagram: { label: "How data reaches a consumer without an account", nodes: [{ id: "p", label: "You (provider)" }, { id: "s", label: "Secure-view share" }, { id: "r", label: "Reader account" }, { id: "u", label: "Consumer users" }], edges: [{ from: "p", to: "s" }, { from: "s", to: "r" }, { from: "r", to: "u" }] },
  questions: [
    { id: "hasAccount", label: "Does the consumer already have a Snowflake account?", options: [{ value: "yes", label: "Yes, they have their own" }, { value: "no", label: "No, and they don't need one" }] },
    { id: "needsOwn", label: "Will they need to load their own data, or share anything onward?", options: [{ value: "no", label: "No, they only query what I share" }, { value: "yes", label: "Yes, they will bring data or share it" }] },
  ],
  recommendations: [
    { when: { hasAccount: "yes", needsOwn: "no" }, title: "Share directly, no reader account needed", text: "They already have an account, so add it to your share and they pay for their own compute. A reader account would only add a bill for you." },
    { when: { hasAccount: "yes", needsOwn: "yes" }, title: "Share directly, no reader account needed", text: "A full account can already load data and share onward. Add it to your share." },
    { when: { hasAccount: "no", needsOwn: "no" }, title: "A reader account fits", text: "They only need to query shared data and have no account. You create the account, add it to a share and carry the compute cost." },
    { when: { hasAccount: "no", needsOwn: "yes" }, tone: "warning", title: "Reader accounts are query-only", text: "Loading data and creating shares are blocked there. If they must do either, they need a full Snowflake account of their own." },
  ],
  assumptions: [
    { id: "readers", label: "Reader accounts", value: 10, min: 1, max: 75 },
    { id: "credits", label: "Credits each account uses per month", value: 20, min: 0, max: 200, step: 5 },
    { id: "price", label: "Price per credit (your contract rate)", value: 3, min: 0, max: 20, step: 0.5 },
  ],
  outputs: [{ label: "Your monthly bill for readers", product: ["readers", "credits", "price"], format: "currency", caption: "Compute only, before any storage." }, { label: "Per year", product: ["readers", "credits", "price"], multiplier: 12, format: "currency", caption: "At the same usage every month." }],
  curve: { vary: "readers", at: [1, 5, 10, 25, 50, 75], xLabel: "Reader accounts", yLabel: "Dollars per month" },
  assumptionsNote: "The defaults are placeholders, not Snowflake prices. Use your contract rate and your own usage; warehouses in a reader account have no built-in ceiling.",
  steps: [
    { id: "create", label: "Create", description: "Provider", caption: "1 · Provider: create the managed account", language: "sql", code: "CREATE MANAGED ACCOUNT acme_reader\n  ADMIN_NAME = 'reader_admin',\n  ADMIN_PASSWORD = '<a strong password>',\n  TYPE = READER;" },
    { id: "share", label: "Share", description: "Provider", caption: "2 · Provider: add it to a share", language: "sql", code: "ALTER SHARE sales_share ADD ACCOUNTS = <reader_account_locator>;\n\n-- Share secure views rather than raw tables when rows must be filtered per consumer." },
    { id: "connect", label: "Connect", description: "Reader admin", caption: "3 · Reader admin: warehouse and database", language: "sql", code: "CREATE WAREHOUSE reader_wh WAREHOUSE_SIZE = 'XSMALL' AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;\n\nCREATE DATABASE sales_data FROM SHARE <provider_account>.sales_share;" },
    { id: "govern", label: "Cap spend", description: "Reader admin", caption: "4 · Cap the spend with a resource monitor", language: "sql", code: "CREATE RESOURCE MONITOR reader_cap\n  WITH CREDIT_QUOTA = 10\n  TRIGGERS ON 90 PERCENT DO NOTIFY\n           ON 100 PERCENT DO SUSPEND;" },
  ],
  checklist: ["A resource monitor is set on the reader account", "Warehouses are XSMALL with a short auto-suspend", "Only secure views are shared, not raw tables", "Someone reviews usage on a schedule", "The consumer knows the account is query-only"],
  faq: [{ title: "Can a reader account see data from other providers?", body: "No. It can only access data shared by the provider account that created it." }, { title: "How do I shut one down?", body: "Drop the managed account from your provider account. Its users lose access immediately, so confirm the consumer is finished first." }],
  sources: [{ label: "Manage reader accounts", href: "https://docs.snowflake.com/en/user-guide/data-sharing-reader-create" }, { label: "Configure a reader account", href: "https://docs.snowflake.com/en/user-guide/data-sharing-reader-config" }],
  asOf: "October 2026",
};

export const queueChoice: Intake = {
  id: "queue-choice-guide", title: "Choosing a message queue: a managed queue or an event log", subject: "Architecture · Messaging",
  reader: "an engineer picking messaging for a new service", summary: "A managed queue hands each message to one worker; an event log keeps a replayable history many readers can consume.",
  explain: "A **queue** such as Amazon SQS delivers each message to one consumer and removes it when it is processed. An **event log** such as Apache Kafka appends messages to partitions that consumers read at their own pace, so several independent readers can replay the same history.\n\nPick by how the messages will be used, then check the running cost and the operational load you are accepting.",
  questions: [
    { id: "replay", label: "Does anyone need to re-read old messages, or several services need the same stream?", options: [{ value: "no", label: "No, each message is processed once" }, { value: "yes", label: "Yes, replay or fan-out matters" }] },
    { id: "team", label: "Can your team run and monitor a cluster, or pay for a managed one?", options: [{ value: "no", label: "No, we want as little to operate as possible" }, { value: "yes", label: "Yes, we can operate it or buy it managed" }] },
  ],
  recommendations: [
    { when: { replay: "no", team: "no" }, title: "A managed queue", text: "One consumer per message and nothing to operate: a managed queue is the smaller commitment." },
    { when: { replay: "no", team: "yes" }, title: "A managed queue is still enough", text: "You can operate more, but you don't need replay. Keep it simple unless that changes." },
    { when: { replay: "yes", team: "yes" }, title: "An event log", text: "Replay and fan-out are what a log is for, and you can run or buy one." },
    { when: { replay: "yes", team: "no" }, tone: "warning", title: "A managed event log, and budget for it", text: "You need replay but don't want to operate a cluster: choose a managed log service and price it with the calculator." },
  ],
  assumptions: [{ id: "messages", label: "Messages per day (millions)", value: 50, min: 1, max: 1000 }, { id: "unit", label: "Cost per million messages (your quote)", value: 0.4, min: 0, max: 10, step: 0.1 }],
  outputs: [{ label: "Estimated monthly cost", product: ["messages", "unit"], multiplier: 30, format: "currency", caption: "Message charges only; excludes storage and data transfer." }],
  curve: { vary: "messages", at: [1, 50, 100, 250, 500, 1000], xLabel: "Million messages per day", yLabel: "Dollars per month" },
  steps: [
    { id: "decide", label: "Decide", description: "Team", caption: "1 · Write down the delivery guarantee you need", language: "text", code: "At-least-once or exactly-once?\nOrdering: per key, or none?\nRetention: how long must a message stay readable?" },
    { id: "provision", label: "Provision", description: "Platform", caption: "2 · Create the resource (example: SQS)", language: "bash", code: "aws sqs create-queue --queue-name <orders-queue>" },
    { id: "monitor", label: "Monitor", description: "On call", caption: "3 · Alert on backlog and age", language: "text", code: "Alert when the oldest message age or the queue depth keeps growing." },
  ],
  checklist: ["Delivery guarantee and ordering are written down", "A dead-letter path exists for poison messages", "Backlog and message age are alerted on", "Consumers are idempotent"],
  sources: [{ label: "Amazon SQS developer guide", href: "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html" }, { label: "Apache Kafka documentation", href: "https://kafka.apache.org/documentation/" }],
  asOf: "October 2026",
};

export const hostingChoice: Intake = {
  id: "redis-hosting-guide", title: "Self-host Redis or buy it managed?", subject: "Operations · Caching",
  reader: "a technical lead weighing run-it-yourself against a managed cache", summary: "Managed costs more per gigabyte and buys back on-call time; self-hosting is cheaper until it isn't.",
  explain: "Running Redis yourself means you own patching, failover, backups and capacity. A managed service takes those on for a premium.\n\nThe honest comparison is the **monthly bill plus the hours your team spends**, so the calculator prices both.",
  questions: [{ id: "oncall", label: "Is there already an on-call rota that would cover a cache?", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }] }],
  recommendations: [{ when: { oncall: "no" }, title: "Go managed", text: "Without an on-call rota, a cache outage becomes your team's problem at 3 a.m. Pay for the managed service." }, { when: { oncall: "yes" }, tone: "info", title: "Compare the totals below", text: "You can carry it. Let the calculator decide: self-hosting wins only if the hours stay small." }],
  assumptions: [{ id: "gb", label: "Memory needed (GB)", value: 16, min: 1, max: 256 }, { id: "rate", label: "Managed price per GB-month (your quote)", value: 25, min: 0, max: 200, step: 1 }, { id: "hours", label: "Engineer hours per month to self-host", value: 8, min: 0, max: 80 }, { id: "wage", label: "Loaded cost per engineer hour", value: 70, min: 0, max: 300, step: 5 }],
  outputs: [{ label: "Managed, per month", product: ["gb", "rate"], format: "currency" }, { label: "Self-hosting labour, per month", product: ["hours", "wage"], format: "currency", caption: "Excludes the servers themselves." }],
  steps: [
    { id: "size", label: "Size it", description: "Team", caption: "1 · Measure before you buy", language: "bash", code: "redis-cli INFO memory | grep used_memory_human" },
    { id: "persist", label: "Persist", description: "Team", caption: "2 · Decide what must survive a restart", language: "text", code: "Cache only: no persistence.\nSession store: AOF with fsync policy chosen deliberately." },
    { id: "failover", label: "Failover", description: "Platform", caption: "3 · Test a failover before you need one", language: "text", code: "Kill the primary in staging and time the recovery." },
  ],
  checklist: ["Memory use is measured, not guessed", "Eviction policy is chosen on purpose", "A failover was tested", "Backups restore into a clean environment"],
  sources: [{ label: "Redis documentation", href: "https://redis.io/docs/latest/" }],
  asOf: "October 2026",
};

export const EXAMPLES: Record<string, Intake> = { "snowflake-reader-accounts": snowflakeReaderAccounts, "queue-choice": queueChoice, "redis-hosting": hostingChoice };
