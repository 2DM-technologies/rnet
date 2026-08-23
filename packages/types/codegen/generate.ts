import { mkdir, readdir } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

interface SchemaDescriptor {
  constName: string;
  typeName: string;
  relativePath: string;
}

const packageRoot = resolve(import.meta.dir, "..");
const repoRoot = resolve(packageRoot, "../..");
const schemaRoot = join(repoRoot, "schemas", "0.1");
const generatedRoot = join(packageRoot, "src", "generated");

const publicNames: Record<string, Pick<SchemaDescriptor, "constName" | "typeName">> = {
  "grant.json": { constName: "grantSchema", typeName: "Grant" },
  "ingest-record.json": { constName: "ingestRecordSchema", typeName: "IngestRecord" },
  "media-element.json": { constName: "mediaElementSchema", typeName: "MediaElement" },
  "media-object.json": { constName: "mediaObjectSchema", typeName: "MediaObject" },
  "origin-artifact.json": { constName: "originArtifactSchema", typeName: "OriginArtifact" },
  "types/track.json": { constName: "trackPropertiesSchema", typeName: "TrackProperties" },
  "types/transaction.json": {
    constName: "transactionPropertiesSchema",
    typeName: "TransactionProperties",
  },
  "vibe.json": { constName: "vibeSchema", typeName: "Vibe" },
};

async function findJsonFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? findJsonFiles(path) : [path];
    }),
  );

  return files.flat().filter((path) => path.endsWith(".json")).sort();
}

function schemaReferences(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) schemaReferences(item, found);
    return found;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref" && typeof child === "string") found.add(child);
      else schemaReferences(child, found);
    }
  }

  return found;
}

function header(source: string): string {
  return `// Generated from ${source}. Do not edit by hand.\n`;
}

async function render(): Promise<Map<string, string>> {
  const paths = await findJsonFiles(schemaRoot);
  const descriptors: SchemaDescriptor[] = paths.map((path) => {
    const relativePath = relative(schemaRoot, path).split(sep).join("/");
    const names = publicNames[relativePath];
    if (!names) throw new Error(`No public name configured for ${relativePath}`);
    return { ...names, relativePath };
  });
  const missing = Object.keys(publicNames).filter(
    (relativePath) => !descriptors.some((descriptor) => descriptor.relativePath === relativePath),
  );
  if (missing.length) throw new Error(`Canonical schemas are missing: ${missing.join(", ")}`);

  const parsed = new Map<string, Record<string, unknown>>();
  for (const descriptor of descriptors) {
    const schema = await Bun.file(join(schemaRoot, descriptor.relativePath)).json();
    parsed.set(descriptor.relativePath, schema);
  }

  const byId = new Map(
    descriptors.map((descriptor) => {
      const schema = parsed.get(descriptor.relativePath);
      return [schema?.$id, descriptor] as const;
    }),
  );

  const schemasSource = [
    header("schemas/0.1/**/*.json"),
    ...descriptors.map((descriptor) => {
      const schema = parsed.get(descriptor.relativePath);
      return `export const ${descriptor.constName} = ${JSON.stringify(schema, null, 2)} as const;\n`;
    }),
    `export const rnetSchemas = [\n${descriptors
      .map((descriptor) => `  ${descriptor.constName},`)
      .join("\n")}\n] as const;\n`,
  ].join("\n");

  const typeImports = descriptors.map((descriptor) => descriptor.constName).join(",\n  ");
  const typeExports = descriptors.map((descriptor) => {
    const schema = parsed.get(descriptor.relativePath);
    const references = [...schemaReferences(schema)]
      .map((id) => byId.get(id))
      .filter((item): item is SchemaDescriptor => Boolean(item));
    const options = references.length
      ? `, { keepDefaultedPropertiesOptional: true; references: [${references.map((item) => `typeof ${item.constName}`).join(", ")}] }`
      : ", { keepDefaultedPropertiesOptional: true }";
    return `export type ${descriptor.typeName} = FromSchema<typeof ${descriptor.constName}${options}>;`;
  });
  const typesSource = `${header("schemas/0.1/**/*.json")}import type { FromSchema } from "json-schema-to-ts";\nimport {\n  ${typeImports},\n} from "./schemas.ts";\n\n${typeExports.join("\n")}\n`;

  return new Map([
    [join(generatedRoot, "schemas.ts"), schemasSource],
    [join(generatedRoot, "types.ts"), typesSource],
  ]);
}

async function main(): Promise<void> {
  const checkOnly = process.argv.includes("--check");
  const outputs = await render();
  const stale: string[] = [];

  for (const [path, content] of outputs) {
    if (checkOnly) {
      const current = await Bun.file(path).text().catch(() => "");
      if (current !== content) stale.push(relative(repoRoot, path));
    } else {
      await mkdir(dirname(path), { recursive: true });
      await Bun.write(path, content);
      console.log(`generated ${relative(repoRoot, path)}`);
    }
  }

  if (stale.length) {
    throw new Error(`Generated files are stale:\n${stale.map((path) => `- ${path}`).join("\n")}\nRun bun run codegen.`);
  }
}

await main();
