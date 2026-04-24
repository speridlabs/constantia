# Changelog

## [2.1.0](https://github.com/speridlabs/constantia/compare/v2.0.0...v2.1.0) (2026-04-24)

### Features

* add AsyncLocalStorage request context, structured logger meta, and request ID ([a116d87](https://github.com/speridlabs/constantia/commit/a116d8719211980b8260c4b604f9836126d9226c))
* add Content-Type decorator ([7fde15e](https://github.com/speridlabs/constantia/commit/7fde15e5966f99368320e76086dc0615ebf7b7fc))
* fix Copilot comment ([f921a00](https://github.com/speridlabs/constantia/commit/f921a007a104d39efe1bcf07c75d2b1763e13d1f))

### Bug Fixes

* address PR review for ContentType and request context ([8d42bbe](https://github.com/speridlabs/constantia/commit/8d42bbefe6cc9bf2e321ca7dc7f7bd69008d857d))
* allow string return type, decorator order and binary OpenAPI schema ([1f9b55e](https://github.com/speridlabs/constantia/commit/1f9b55e9a0760c8881b13a3149d236eb1e513042))
* clean up pending maps and add requestId to fallback handler ([e2c02a3](https://github.com/speridlabs/constantia/commit/e2c02a3166d0ceab4b45a95c9ec4bdfd4be593bd))
* fix Copilot comment about decorator order ([046dadc](https://github.com/speridlabs/constantia/commit/046dadcdcd501f053b5ebf1e155384e161160e11))
* restore CHANGELOG.md from master ([94c8689](https://github.com/speridlabs/constantia/commit/94c8689f87e43649775d5c06ba69ad004b347692))

## [2.0.0](https://github.com/speridlabs/constantia/compare/v1.1.3...v2.0.0) (2026-04-21)

### ⚠ BREAKING CHANGES

* **express:** IFrameworkAdapter now requires a finalize() method.
Existing consumers that use the exported wrappers are unaffected;
custom adapter implementations must add finalize() (can be a no-op).

### Features

* **express:** handle OPTIONS preflights and CORS on unmatched routes ([4b1bd48](https://github.com/speridlabs/constantia/commit/4b1bd48f202db7876d2b8cd07f6906940b6aa6b9))

## [1.1.3](https://github.com/speridlabs/constantia/compare/v1.1.2...v1.1.3) (2026-04-16)

### Bug Fixes

* **express:** skip auto-response when handler already sent headers ([15be69d](https://github.com/speridlabs/constantia/commit/15be69decd5a2b0112eda4cbf543b33489e669cb))

## [1.1.2](https://github.com/speridlabs/constantia/compare/v1.1.1...v1.1.2) (2026-04-16)

### Bug Fixes

* **express:** global middlewares now wrap route pipeline so they can catch controller errors ([b3f18b6](https://github.com/speridlabs/constantia/commit/b3f18b61663e6a0119fdf8dfa0b5d396eae56638))

## [1.1.1](https://github.com/speridlabs/constantia/compare/v1.1.0...v1.1.1) (2026-04-07)

### Bug Fixes

* context injection distinguishes missing keys from undefined values ([eb8d083](https://github.com/speridlabs/constantia/commit/eb8d0836f141b1a54c13fddbdc88a4c2371b27ed))

## [1.1.0](https://github.com/speridlabs/constantia/compare/v1.0.3...v1.1.0) (2026-04-07)

### Features

* auto-detect raw PUT bodies in @File/@Files decorators ([fdc5dbe](https://github.com/speridlabs/constantia/commit/fdc5dbeb37eb00af7a8cf8e3e07383014559bfd7))

## [1.0.3](https://github.com/speridlabs/constantia/compare/v1.0.2...v1.0.3) (2026-04-04)

### Bug Fixes

* add Record/index-signature support for schema generation and validation ([3901ac6](https://github.com/speridlabs/constantia/commit/3901ac6d677c654e385e75a15a698b38f8b2ad14))

## [1.0.2](https://github.com/speridlabs/constantia/compare/v1.0.1...v1.0.2) (2026-04-02)

### Bug Fixes

* handle body-parser errors gracefully in ExpressAdapter ([c6cc51a](https://github.com/speridlabs/constantia/commit/c6cc51a2961f01d7f37d8e9c8aa0e7ade5e01795))

## [1.0.1](https://github.com/speridlabs/constantia/compare/v1.0.0...v1.0.1) (2026-02-02)

### Bug Fixes

* export types with 'export *' to preserve Deepkit runtime type metadata ([ae248d4](https://github.com/speridlabs/constantia/commit/ae248d4c0b62312b0846381831e1c82e87afe3bd))

## 1.0.0 (2026-02-01)

### Features

* initial release of constantia framework ([696990d](https://github.com/speridlabs/constantia/commit/696990d5996953f9475d92c87db0fee849c1b47b))
* initial release of constantia framework ([50c038e](https://github.com/speridlabs/constantia/commit/50c038e866c4847500049bd15f1af5ab170655f6))
