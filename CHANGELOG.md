# Change Log - stratifyjs

<!-- This log was last generated on Tue, 08 Sep 2026 21:10:39 GMT and should not be manually modified. -->

<!-- Start content -->

## 4.0.0

Tue, 08 Sep 2026 21:10:39 GMT

### Major changes

- Support empty membership allowlists and explicit dependency exceptions with mutually exclusive inline and file-backed configuration (walterb@microsoft.com)

## 3.0.0

We, 05 March 2026 10:00:00 GMT

### Major changes

- **BREAKING:** Layer validation now defaults to checking only `dependencies` instead of all three dependency fields. Projects that relied on `devDependencies` or `peerDependencies` being validated must add `"dependencyTypes": ["dependencies", "devDependencies", "peerDependencies"]` to their `workspaces` config to restore the previous behavior. (wbarrantes@hotmail.com)

### Minor changes

- Added `workspaces.dependencyTypes` config option to control which `package.json` dependency fields are checked during layer validation. Valid values: `"dependencies"`, `"devDependencies"`, `"peerDependencies"`. Defaults to `["dependencies"]`. (wbarrantes@hotmail.com)

## 2.1.0

Tu, 03 March 2026 10:00:00 GMT

### Minor changes

- Configurable dependency protocols & ignore patterns (wbarrantes@hotmail.com)

## 2.0.0

Initial release.
