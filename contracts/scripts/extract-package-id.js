#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const contractsDir = path.resolve(new URL('..', import.meta.url).pathname);
const defaultFiles = [
  path.join(contractsDir, 'deployments/testnet/latest-upgrade.json'),
  path.join(contractsDir, 'deployments/testnet/latest-publish.json'),
];

const filePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : defaultFiles.find((candidate) => fs.existsSync(candidate));

if (!filePath) {
  console.error('No deployment JSON found. Pass a file path or run publish/upgrade first.');
  process.exit(1);
}

const root = JSON.parse(fs.readFileSync(filePath, 'utf8'));

function objectTypeIncludes(value, fragment) {
  return typeof value === 'string' && value.includes(fragment);
}

function findPublishedPackageId(value) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPublishedPackageId(item);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  if (
    value.type === 'published' &&
    typeof value.packageId === 'string'
  ) {
    return value.packageId;
  }

  if (
    typeof value.packageId === 'string' &&
    (objectTypeIncludes(value.objectType, '::package::UpgradeCap') ||
      objectTypeIncludes(value.objectType, '::package::Publisher'))
  ) {
    return value.packageId;
  }

  if (typeof value.package_id === 'string') {
    return value.package_id;
  }

  for (const child of Object.values(value)) {
    const found = findPublishedPackageId(child);
    if (found) {
      return found;
    }
  }

  return undefined;
}

const packageId = findPublishedPackageId(root);

if (!packageId) {
  console.error(`Could not find packageId in ${filePath}`);
  process.exit(1);
}

console.log(`NEXT_PUBLIC_PACKAGE_ID=${packageId}`);
console.log(`PACKAGE_ID=${packageId}`);
