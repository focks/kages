---
title: Snowflake reader accounts, explained
eyebrow: Snowflake · Data sharing
description: How to share data with people who don't have a Snowflake account.
---

# Ignored when front matter has a title

Body starts here, not in the hero.

## The problem they solve

Secure data sharing lets a provider expose **live, read-only** data to another account. See the [docs](https://docs.snowflake.com/en/user-guide/data-sharing-reader-create).

- No copies
- No pipelines

> **Note:** A reader account is owned and paid for by the provider.

## Set one up

Create the account, then add it to a share.

```sh
snow sql -q "CREATE MANAGED ACCOUNT acme_reader ADMIN_NAME='a', ADMIN_PASSWORD='x', TYPE=READER"
```
```python
cursor.execute("CREATE MANAGED ACCOUNT acme_reader ...")
```

> [!WARNING]
> Warehouses in a reader account have no built-in ceiling.

### Cost controls

Use a resource monitor.

| Topic | Reader account | Full account |
| --- | --- | --- |
| Who pays | The provider | The consumer |
| Loading data | Not allowed | Allowed |

![A diagram of the share](https://example.com/share.png)

---

$$E = mc^2$$

## Questions people ask

### Who should use one?

Consumers with no Snowflake account.

### Can a reader see other providers' data?

No. Only the provider that created it.
