# Sanity Blogging Content Studio

## Workspace authority

This package's active Sanity v3 authority is `sanity.config.js`, with commands and dependencies owned by `package.json` and CLI settings owned by `sanity.cli.js`.

- `/studio` is the deployed production-dataset workspace. `vercel.json` owns its rewrite, and Sanity authentication remains the access boundary.
- `/staging-studio` is a local-development-only workspace for CMS authors. `sanity.config.js` includes it only when Vite reports development mode; no Vercel rewrite or deployed URL is promised for it.

## Retained legacy configuration

The following Sanity v2-era files are archived in place as compatibility and migration evidence. They are not active Sanity v3 configuration, are not deletion candidates, and must remain untouched unless a separately evidenced migration workflow requires them.

| Path | Disposition | Retained knowledge |
| --- | --- | --- |
| `sanity.config.js` | Keep — active | Sanity v3 production and local-only staging workspace definitions, schemas, tools, and branding. |
| `package.json` | Keep — active | Sanity v3 command and dependency authority. |
| `sanity.json` | Archive in place | Sanity v2 project, dataset, base-path, plugin, development-dataset, and schema-part settings. |
| `config/.checksums` | Archive in place | Sanity-managed provenance for the retained v2 plugin configuration. |
| `config/@sanity/data-aspects.json` | Archive in place | Legacy list-option metadata. |
| `config/@sanity/default-layout.json` | Archive in place | Legacy tool-switcher ordering and visibility metadata. |
| `config/@sanity/default-login.json` | Archive in place | Legacy login-provider and login-method metadata. |
| `config/@sanity/form-builder.json` | Archive in place | Legacy direct-image-upload setting. |
| `config/@sanity/vision.json` | Archive in place | Legacy Vision API-version setting. |

Retention is deliberate: the active v3 config already carries the still-current project, datasets, workspaces, schema, Vision, and branding contracts, while the remaining v2-only settings have no proven v3 consumer and are preserved rather than guessed into the active config.

Congratulations, you have now installed the Sanity Content Studio, an open source real-time content editing environment connected to the Sanity backend.

Now you can do the following things:

- [Read “getting started” in the docs](https://www.sanity.io/docs/introduction/getting-started?utm_source=readme)
- Check out the example frontend: [React/Next.js](https://github.com/sanity-io/tutorial-sanity-blog-react-next)
- [Read the blog post about this template](https://www.sanity.io/blog/build-your-own-blog-with-sanity-and-next-js?utm_source=readme)
- [Join the community Slack](https://slack.sanity.io/?utm_source=readme)
- [Extend and build plugins](https://www.sanity.io/docs/content-studio/extending?utm_source=readme)
