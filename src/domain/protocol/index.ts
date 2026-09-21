import canonicalize from "canonicalize";
import Decimal from "decimal.js";
import { z } from "zod";

const ProtocolDecimal = Decimal.clone({
  precision: 120,
  rounding: Decimal.ROUND_HALF_EVEN,
  toExpNeg: -1_000_000_000,
  toExpPos: 1_000_000_000,
});

const decimalString = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/, "Must be a decimal string")
  .refine((value) => {
    const decimal = new ProtocolDecimal(value);
    const normalized = decimal.isZero() ? "0" : decimal.toFixed();
    return normalized === value;
  }, "Must be a canonical decimal string");

const durationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("untimed") }).strict(),
  z.object({ kind: z.literal("fixed"), seconds: decimalString }).strict(),
  z
    .object({
      kind: z.literal("derived"),
      variableId: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
    })
    .strict(),
]);

const sectionSchema = z
  .object({
    sectionId: z.uuid(),
    title: z.string().min(1),
    markdown: z.string(),
    duration: durationSchema,
    endAction: z.enum(["wait", "advance"]),
    completionRequirement: z.literal("all-task-items").optional(),
  })
  .strict();

const variableId = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);

const inputVariableSchema = z.discriminatedUnion("valueType", [
  z
    .object({
      kind: z.literal("input"),
      id: variableId,
      label: z.string().min(1),
      valueType: z.literal("text"),
      defaultValue: z.string().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("input"),
      id: variableId,
      label: z.string().min(1),
      valueType: z.literal("numeric"),
      defaultValue: decimalString.optional(),
      minimum: decimalString.optional(),
      maximum: decimalString.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("input"),
      id: variableId,
      label: z.string().min(1),
      valueType: z.literal("boolean"),
      defaultValue: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("input"),
      id: variableId,
      label: z.string().min(1),
      valueType: z.literal("enum"),
      options: z.array(z.string().min(1)).min(1),
      defaultValue: z.string().optional(),
    })
    .strict(),
]);

const derivedVariableSchema = z
  .object({
    kind: z.literal("derived"),
    id: variableId,
    label: z.string().min(1),
    valueType: z.literal("numeric"),
    formula: z.string(),
    precision: z.number().int().min(0).max(100),
    roundingMode: z.literal("half-even"),
  })
  .strict();

const variableDefinitionSchema = z.union([
  inputVariableSchema,
  derivedVariableSchema,
]);

const formulaInputValueSchema = z.union([
  z.string(),
  z.boolean(),
]);

const formulaTestCaseSchema = z
  .object({
    testCaseId: z.uuid(),
    name: z.string().min(1),
    description: z.string().optional(),
    inputValues: z.record(variableId, formulaInputValueSchema),
    expectedDerivedValues: z.record(variableId, decimalString),
    precision: z.number().int().min(0).max(100),
    roundingMode: z.literal("half-even"),
  })
  .strict();

const protocolSchema = z
  .object({
    protocolId: z.uuid(),
    title: z.string().min(1),
    sections: z.array(sectionSchema),
    variables: z.array(variableDefinitionSchema),
    formulaTestCases: z.array(formulaTestCaseSchema),
    derivedFromFingerprint: z.string().optional(),
  })
  .strict();

const base64url = z.string().regex(/^[A-Za-z0-9_-]+$/);

const signatureSchema = z
  .object({
    algorithm: z.literal("ECDSA-P256-SHA256"),
    publicKeySpki: base64url,
    keyId: z.string().regex(/^[0-9a-f]{64}$/),
    value: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
  })
  .strict();

const envelopeSchema = z.discriminatedUnion("documentKind", [
  z
    .object({
      documentKind: z.literal("protocol-box/application"),
      formatVersion: z.literal(1),
      appVersion: z.string().min(1),
      protocol: z.null(),
      signature: z.null(),
    })
    .strict(),
  z
    .object({
      documentKind: z.literal("protocol-box/published-protocol"),
      formatVersion: z.literal(1),
      appVersion: z.string().min(1),
      protocol: protocolSchema,
      signature: signatureSchema,
    })
    .strict(),
]);

export type Protocol = z.infer<typeof protocolSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type VariableDefinition = z.infer<typeof variableDefinitionSchema>;
export type FormulaTestCase = z.infer<typeof formulaTestCaseSchema>;
export type Envelope = z.infer<typeof envelopeSchema>;
export type Signature = z.infer<typeof signatureSchema>;

export interface ProtocolError {
  code: string;
  path: string;
  message: string;
}

export class ProtocolCoreFailure extends Error {
  constructor(
    readonly code: string,
    readonly path: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ProtocolCoreFailure";
  }
}

export interface ProtocolInspection {
  format: "valid" | "invalid";
  playable: boolean;
  errors: ProtocolError[];
}

export interface ProtocolResourceContext {
  importedHtmlBytes?: number;
  publishedHtmlBytes?: number;
  images?: Array<{
    path: string;
    encodedBytes: number;
    pixels: number;
  }>;
}

export interface EnvelopeInspection extends ProtocolInspection {
  signature: "match" | "mismatch" | "unverified";
  protocol?: Protocol;
}

export type EnvelopeDecodeResult =
  | { ok: true; envelope: Envelope }
  | { ok: false; errors: ProtocolError[] };

export type VariableValue = string | boolean;
export type ProtocolEvaluationResult =
  | { ok: true; values: Record<string, VariableValue> }
  | { ok: false; errors: ProtocolError[] };

export type VariableDependencyFormulaDiagnosticCode =
  | "formula_too_long"
  | "invalid_number"
  | "invalid_token"
  | "invalid_formula"
  | "formula_error";

export type VariableDependencyGraphDiagnosticCode =
  | VariableDependencyFormulaDiagnosticCode
  | "unknown_variable"
  | "non_numeric_variable"
  | "cyclic_dependency";

export interface VariableDependencyVariableNode {
  readonly kind: "variable";
  readonly id: string;
  readonly variableIndex: number;
  readonly variable: VariableDefinition;
  readonly diagnosticCodes: readonly VariableDependencyGraphDiagnosticCode[];
  readonly cycleMember: boolean;
}

export interface VariableDependencyUnknownNode {
  readonly kind: "unknown";
  readonly id: string;
  readonly referencedVariableId: string;
  readonly diagnosticCodes: readonly ["unknown_variable"];
  readonly cycleMember: false;
}

export type VariableDependencyGraphNode =
  | VariableDependencyVariableNode
  | VariableDependencyUnknownNode;

export interface VariableDependencyGraphEdge {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly derivedVariableIndex: number;
  readonly referenceIndex: number;
  readonly diagnosticCodes: readonly VariableDependencyGraphDiagnosticCode[];
  readonly cycleMember: boolean;
}

export interface VariableDependencyFormulaDiagnostic {
  readonly kind: "invalid-formula";
  readonly code: VariableDependencyFormulaDiagnosticCode;
  readonly path: string;
  readonly message: string;
  readonly variableId: string;
  readonly variableIndex: number;
  readonly nodeIds: readonly [string];
  readonly edgeIds: readonly [];
}

export interface VariableDependencyUnknownReferenceDiagnostic {
  readonly kind: "unknown-reference";
  readonly code: "unknown_variable";
  readonly path: string;
  readonly message: string;
  readonly variableId: string;
  readonly variableIndex: number;
  readonly referencedVariableId: string;
  readonly nodeIds: readonly [string, string];
  readonly edgeIds: readonly [string];
}

export interface VariableDependencyNonNumericReferenceDiagnostic {
  readonly kind: "non-numeric-reference";
  readonly code: "non_numeric_variable";
  readonly path: string;
  readonly message: string;
  readonly variableId: string;
  readonly variableIndex: number;
  readonly referencedVariableId: string;
  readonly nodeIds: readonly [string, string];
  readonly edgeIds: readonly [string];
}

export interface VariableDependencyCycleDiagnostic {
  readonly kind: "cycle";
  readonly code: "cyclic_dependency";
  readonly path: "variables";
  readonly message: string;
  readonly cyclePath: readonly string[];
  readonly nodeIds: readonly string[];
  readonly edgeIds: readonly string[];
}

export type VariableDependencyGraphDiagnostic =
  | VariableDependencyFormulaDiagnostic
  | VariableDependencyUnknownReferenceDiagnostic
  | VariableDependencyNonNumericReferenceDiagnostic
  | VariableDependencyCycleDiagnostic;

export interface VariableDependencyGraphInspection {
  readonly nodes: readonly VariableDependencyGraphNode[];
  readonly edges: readonly VariableDependencyGraphEdge[];
  readonly diagnostics: readonly VariableDependencyGraphDiagnostic[];
}

type FormulaToken =
  | { kind: "number"; value: string; offset: number }
  | { kind: "identifier"; value: string; offset: number }
  | { kind: "symbol"; value: "+" | "-" | "*" | "/" | "(" | ")" | ","; offset: number }
  | { kind: "end"; offset: number };

type FormulaExpression =
  | { kind: "number"; value: string }
  | { kind: "variable"; id: string }
  | { kind: "unary"; operator: "+" | "-"; operand: FormulaExpression }
  | {
      kind: "binary";
      operator: "+" | "-" | "*" | "/";
      left: FormulaExpression;
      right: FormulaExpression;
    }
  | { kind: "call"; name: string; arguments: FormulaExpression[] };

class FormulaFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function tokenizeFormula(source: string): FormulaToken[] {
  if (source.length > 2_000) {
    throw new FormulaFailure("formula_too_long", "Formula exceeds 2,000 characters");
  }

  const tokens: FormulaToken[] = [];
  let offset = 0;
  while (offset < source.length) {
    const character = source[offset]!;
    if (/\s/.test(character)) {
      offset += 1;
      continue;
    }
    if (/[0-9]/.test(character)) {
      const start = offset;
      while (offset < source.length && /[0-9.]/.test(source[offset]!)) {
        offset += 1;
      }
      const value = source.slice(start, offset);
      if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
        throw new FormulaFailure("invalid_number", `Invalid number at ${start}`);
      }
      tokens.push({ kind: "number", value, offset: start });
      continue;
    }
    if (/[A-Za-z_]/.test(character)) {
      const start = offset;
      while (
        offset < source.length &&
        /[A-Za-z0-9_]/.test(source[offset]!)
      ) {
        offset += 1;
      }
      tokens.push({
        kind: "identifier",
        value: source.slice(start, offset),
        offset: start,
      });
      continue;
    }
    if ("+-*/(),".includes(character)) {
      tokens.push({
        kind: "symbol",
        value: character as Extract<FormulaToken, { kind: "symbol" }>["value"],
        offset,
      });
      offset += 1;
      continue;
    }
    throw new FormulaFailure(
      "invalid_token",
      `Unsupported token at ${offset}`,
    );
  }
  tokens.push({ kind: "end", offset });
  return tokens;
}

class FormulaParser {
  private position = 0;

  constructor(private readonly tokens: FormulaToken[]) {}

  parse(): FormulaExpression {
    const expression = this.parseExpression(0);
    if (this.current().kind !== "end") {
      throw new FormulaFailure(
        "invalid_formula",
        `Unexpected token at ${this.current().offset}`,
      );
    }
    return expression;
  }

  private parseExpression(minimumBindingPower: number): FormulaExpression {
    let left = this.parsePrefix();
    while (true) {
      const token = this.current();
      if (
        token.kind !== "symbol" ||
        (token.value !== "+" &&
          token.value !== "-" &&
          token.value !== "*" &&
          token.value !== "/")
      ) {
        return left;
      }
      const bindingPower = token.value === "+" || token.value === "-" ? 10 : 20;
      if (bindingPower < minimumBindingPower) {
        return left;
      }
      this.position += 1;
      left = {
        kind: "binary",
        operator: token.value,
        left,
        right: this.parseExpression(bindingPower + 1),
      };
    }
  }

  private parsePrefix(): FormulaExpression {
    const token = this.current();
    this.position += 1;
    if (token.kind === "number") {
      return { kind: "number", value: token.value };
    }
    if (token.kind === "identifier") {
      if (this.isSymbol("(")) {
        this.position += 1;
        const arguments_: FormulaExpression[] = [];
        if (!this.isSymbol(")")) {
          do {
            arguments_.push(this.parseExpression(0));
            if (!this.isSymbol(",")) {
              break;
            }
            this.position += 1;
          } while (!this.isSymbol(")"));
        }
        this.expectSymbol(")");
        return { kind: "call", name: token.value, arguments: arguments_ };
      }
      return { kind: "variable", id: token.value };
    }
    if (token.kind === "symbol" && (token.value === "+" || token.value === "-")) {
      return {
        kind: "unary",
        operator: token.value,
        operand: this.parseExpression(30),
      };
    }
    if (token.kind === "symbol" && token.value === "(") {
      const expression = this.parseExpression(0);
      this.expectSymbol(")");
      return expression;
    }
    throw new FormulaFailure(
      "invalid_formula",
      `Expected an expression at ${token.offset}`,
    );
  }

  private current(): FormulaToken {
    return this.tokens[this.position] ?? this.tokens[this.tokens.length - 1]!;
  }

  private isSymbol(value: Extract<FormulaToken, { kind: "symbol" }>["value"]): boolean {
    const token = this.current();
    return token.kind === "symbol" && token.value === value;
  }

  private expectSymbol(
    value: Extract<FormulaToken, { kind: "symbol" }>["value"],
  ): void {
    if (!this.isSymbol(value)) {
      throw new FormulaFailure(
        "invalid_formula",
        `Expected '${value}' at ${this.current().offset}`,
      );
    }
    this.position += 1;
  }
}

function evaluateExpression(
  expression: FormulaExpression,
  resolveVariable: (id: string) => Decimal,
): Decimal {
  if (expression.kind === "number") {
    return new ProtocolDecimal(expression.value);
  }
  if (expression.kind === "variable") {
    return resolveVariable(expression.id);
  }
  if (expression.kind === "unary") {
    const value = evaluateExpression(expression.operand, resolveVariable);
    return expression.operator === "-" ? value.negated() : value;
  }
  if (expression.kind === "binary") {
    const left = evaluateExpression(expression.left, resolveVariable);
    const right = evaluateExpression(expression.right, resolveVariable);
    if (expression.operator === "+") return left.plus(right);
    if (expression.operator === "-") return left.minus(right);
    if (expression.operator === "*") return left.times(right);
    if (right.isZero()) {
      throw new FormulaFailure("division_by_zero", "Division by zero");
    }
    return left.dividedBy(right);
  }

  const values = expression.arguments.map((argument) =>
    evaluateExpression(argument, resolveVariable),
  );
  if ((expression.name === "min" || expression.name === "max") && values.length > 0) {
    return expression.name === "min"
      ? ProtocolDecimal.min(...values)
      : ProtocolDecimal.max(...values);
  }
  if (
    (expression.name === "ceil" || expression.name === "floor") &&
    values.length === 1
  ) {
    return values[0]!.toDecimalPlaces(
      0,
      expression.name === "ceil" ? Decimal.ROUND_CEIL : Decimal.ROUND_FLOOR,
    );
  }
  if (
    expression.name === "round" &&
    (values.length === 1 || values.length === 2)
  ) {
    const precision = values[1]?.toNumber() ?? 0;
    if (!Number.isInteger(precision) || precision < 0 || precision > 100) {
      throw new FormulaFailure("invalid_function", "Invalid round precision");
    }
    return values[0]!.toDecimalPlaces(precision, Decimal.ROUND_HALF_EVEN);
  }
  throw new FormulaFailure(
    "invalid_function",
    `Unsupported function or argument count: ${expression.name}`,
  );
}

function collectVariableReferences(
  expression: FormulaExpression,
  references = new Set<string>(),
): Set<string> {
  if (expression.kind === "variable") {
    references.add(expression.id);
  } else if (expression.kind === "unary") {
    collectVariableReferences(expression.operand, references);
  } else if (expression.kind === "binary") {
    collectVariableReferences(expression.left, references);
    collectVariableReferences(expression.right, references);
  } else if (expression.kind === "call") {
    for (const argument of expression.arguments) {
      collectVariableReferences(argument, references);
    }
  }
  return references;
}

function formulaDiagnosticCode(
  failure: FormulaFailure,
): VariableDependencyFormulaDiagnosticCode {
  if (
    failure.code === "formula_too_long" ||
    failure.code === "invalid_number" ||
    failure.code === "invalid_token" ||
    failure.code === "invalid_formula"
  ) {
    return failure.code;
  }
  return "formula_error";
}

function inspectVariableDependencyGraph(
  protocol: Protocol,
): VariableDependencyGraphInspection {
  interface NodeRecord {
    kind: "variable" | "unknown";
    id: string;
    variableIndex?: number;
    variable?: VariableDefinition;
    referencedVariableId?: string;
    diagnosticCodes: Set<VariableDependencyGraphDiagnosticCode>;
    cycleMember: boolean;
  }

  interface EdgeRecord {
    id: string;
    sourceId: string;
    targetId: string;
    derivedVariableIndex: number;
    referenceIndex: number;
    diagnosticCodes: Set<VariableDependencyGraphDiagnosticCode>;
    cycleMember: boolean;
  }

  const nodes: NodeRecord[] = protocol.variables.map((variable, variableIndex) => ({
    kind: "variable",
    id: variable.id,
    variableIndex,
    variable,
    diagnosticCodes: new Set(),
    cycleMember: false,
  }));
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const definitionsById = new Map(
    protocol.variables.map((definition) => [definition.id, definition]),
  );
  const edges: EdgeRecord[] = [];
  const diagnostics: VariableDependencyGraphDiagnostic[] = [];

  for (const [variableIndex, definition] of protocol.variables.entries()) {
    if (definition.kind !== "derived") continue;
    const targetNode = nodesById.get(definition.id)!;
    let references: string[];
    try {
      const expression = new FormulaParser(
        tokenizeFormula(definition.formula),
      ).parse();
      references = [...collectVariableReferences(expression)];
    } catch (error) {
      const failure =
        error instanceof FormulaFailure
          ? error
          : new FormulaFailure("formula_error", "Formula parsing failed");
      const code = formulaDiagnosticCode(failure);
      targetNode.diagnosticCodes.add(code);
      diagnostics.push({
        kind: "invalid-formula",
        code,
        path: `variables.${variableIndex}.formula`,
        message: failure.message,
        variableId: definition.id,
        variableIndex,
        nodeIds: [definition.id],
        edgeIds: [],
      });
      continue;
    }

    for (const [referenceIndex, referencedVariableId] of references.entries()) {
      const referenced = definitionsById.get(referencedVariableId);
      let sourceNode = nodesById.get(referencedVariableId);
      if (sourceNode === undefined) {
        sourceNode = {
          kind: "unknown",
          id: referencedVariableId,
          referencedVariableId,
          diagnosticCodes: new Set(["unknown_variable"]),
          cycleMember: false,
        };
        nodes.push(sourceNode);
        nodesById.set(referencedVariableId, sourceNode);
      }

      const edge: EdgeRecord = {
        id: `${referencedVariableId}->${definition.id}`,
        sourceId: referencedVariableId,
        targetId: definition.id,
        derivedVariableIndex: variableIndex,
        referenceIndex,
        diagnosticCodes: new Set(),
        cycleMember: false,
      };
      edges.push(edge);

      if (referenced === undefined) {
        edge.diagnosticCodes.add("unknown_variable");
        targetNode.diagnosticCodes.add("unknown_variable");
        diagnostics.push({
          kind: "unknown-reference",
          code: "unknown_variable",
          path: `variables.${variableIndex}.formula`,
          message: `Unknown variable: ${referencedVariableId}`,
          variableId: definition.id,
          variableIndex,
          referencedVariableId,
          nodeIds: [referencedVariableId, definition.id],
          edgeIds: [edge.id],
        });
      } else if (
        referenced.kind === "input" &&
        referenced.valueType !== "numeric"
      ) {
        sourceNode.diagnosticCodes.add("non_numeric_variable");
        targetNode.diagnosticCodes.add("non_numeric_variable");
        edge.diagnosticCodes.add("non_numeric_variable");
        diagnostics.push({
          kind: "non-numeric-reference",
          code: "non_numeric_variable",
          path: `variables.${variableIndex}.formula`,
          message: `Formula variable is not numeric: ${referencedVariableId}`,
          variableId: definition.id,
          variableIndex,
          referencedVariableId,
          nodeIds: [referencedVariableId, definition.id],
          edgeIds: [edge.id],
        });
      }
    }
  }

  const derivedIds = protocol.variables
    .filter((definition) => definition.kind === "derived")
    .map((definition) => definition.id);
  const derivedIdSet = new Set(derivedIds);
  const outgoing = new Map<string, EdgeRecord[]>();
  for (const edge of edges) {
    if (!derivedIdSet.has(edge.sourceId) || !derivedIdSet.has(edge.targetId)) {
      continue;
    }
    const outgoingEdges = outgoing.get(edge.sourceId) ?? [];
    outgoingEdges.push(edge);
    outgoing.set(edge.sourceId, outgoingEdges);
  }

  let nextIndex = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  const connect = (id: string): void => {
    indices.set(id, nextIndex);
    lowLinks.set(id, nextIndex);
    nextIndex += 1;
    stack.push(id);
    onStack.add(id);

    for (const edge of outgoing.get(id) ?? []) {
      const targetId = edge.targetId;
      if (!indices.has(targetId)) {
        connect(targetId);
        lowLinks.set(
          id,
          Math.min(lowLinks.get(id)!, lowLinks.get(targetId)!),
        );
      } else if (onStack.has(targetId)) {
        lowLinks.set(
          id,
          Math.min(lowLinks.get(id)!, indices.get(targetId)!),
        );
      }
    }

    if (lowLinks.get(id) !== indices.get(id)) return;
    const component: string[] = [];
    while (stack.length > 0) {
      const member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
      if (member === id) break;
    }
    components.push(component);
  };
  for (const id of derivedIds) {
    if (!indices.has(id)) connect(id);
  }

  const variableOrder = new Map(
    protocol.variables.map((definition, index) => [definition.id, index]),
  );
  const findCyclePath = (
    startId: string,
    componentIds: Set<string>,
  ): string[] => {
    const path = [startId];
    const visited = new Set([startId]);
    const search = (id: string): boolean => {
      for (const edge of outgoing.get(id) ?? []) {
        if (!componentIds.has(edge.targetId)) continue;
        if (edge.targetId === startId) {
          path.push(startId);
          return true;
        }
        if (visited.has(edge.targetId)) continue;
        visited.add(edge.targetId);
        path.push(edge.targetId);
        if (search(edge.targetId)) return true;
        path.pop();
      }
      return false;
    };
    search(startId);
    return path;
  };

  components.sort(
    (left, right) =>
      Math.min(...left.map((id) => variableOrder.get(id)!)) -
      Math.min(...right.map((id) => variableOrder.get(id)!)),
  );
  for (const component of components) {
    const componentIds = new Set(component);
    const componentEdges = edges.filter(
      (edge) =>
        componentIds.has(edge.sourceId) && componentIds.has(edge.targetId),
    );
    if (
      component.length === 1 &&
      !componentEdges.some((edge) => edge.sourceId === edge.targetId)
    ) {
      continue;
    }

    const nodeIds = [...component].sort(
      (left, right) =>
        variableOrder.get(left)! - variableOrder.get(right)!,
    );
    const edgeIds = componentEdges.map((edge) => edge.id);
    for (const nodeId of nodeIds) {
      const node = nodesById.get(nodeId)!;
      node.cycleMember = true;
      node.diagnosticCodes.add("cyclic_dependency");
    }
    for (const edge of componentEdges) {
      edge.cycleMember = true;
      edge.diagnosticCodes.add("cyclic_dependency");
    }
    const cyclePath = findCyclePath(nodeIds[0]!, componentIds);
    diagnostics.push({
      kind: "cycle",
      code: "cyclic_dependency",
      path: "variables",
      message: `Cyclic Derived Variable dependency: ${cyclePath[0]}`,
      cyclePath,
      nodeIds,
      edgeIds,
    });
  }

  return {
    nodes: nodes.map((node): VariableDependencyGraphNode => {
      if (node.kind === "unknown") {
        return {
          kind: "unknown",
          id: node.id,
          referencedVariableId: node.referencedVariableId!,
          diagnosticCodes: ["unknown_variable"],
          cycleMember: false,
        };
      }
      return {
        kind: "variable",
        id: node.id,
        variableIndex: node.variableIndex!,
        variable: node.variable!,
        diagnosticCodes: [...node.diagnosticCodes],
        cycleMember: node.cycleMember,
      };
    }),
    edges: edges.map((edge) => ({
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      derivedVariableIndex: edge.derivedVariableIndex,
      referenceIndex: edge.referenceIndex,
      diagnosticCodes: [...edge.diagnosticCodes],
      cycleMember: edge.cycleMember,
    })),
    diagnostics,
  };
}

function canonicalDecimal(value: Decimal): string {
  if (!value.isFinite()) {
    throw new FormulaFailure("non_finite_result", "Formula result is not finite");
  }
  const normalized = value.isZero() ? new ProtocolDecimal(0) : value;
  return normalized.toFixed();
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function base64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    throw new Error("Invalid base64url");
  }
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function decodeBase64(value: string): Uint8Array {
  const decoded = atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function imageDimensions(
  mimeType: string,
  bytes: Uint8Array,
): { width: number; height: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    mimeType === "image/png" &&
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => bytes[index] === byte,
    )
  ) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (
    mimeType === "image/jpeg" &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8
  ) {
    let offset = 2;
    const startOfFrame = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
      0xce, 0xcf,
    ]);
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) return undefined;
      const marker = bytes[offset + 1]!;
      if (startOfFrame.has(marker)) {
        return {
          width: view.getUint16(offset + 7),
          height: view.getUint16(offset + 5),
        };
      }
      if (marker === 0xd9 || marker === 0xda) return undefined;
      const length = view.getUint16(offset + 2);
      if (length < 2) return undefined;
      offset += length + 2;
    }
  }
  if (
    mimeType === "image/webp" &&
    bytes.length >= 30 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    const kind = String.fromCharCode(...bytes.slice(12, 16));
    if (kind === "VP8X") {
      const width =
        1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16);
      const height =
        1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16);
      return { width, height };
    }
    if (kind === "VP8L" && bytes[20] === 0x2f) {
      return {
        width: 1 + bytes[21]! + ((bytes[22]! & 0x3f) << 8),
        height:
          1 +
          (bytes[22]! >> 6) +
          (bytes[23]! << 2) +
          ((bytes[24]! & 0x0f) << 10),
      };
    }
    if (
      kind === "VP8 " &&
      bytes[23] === 0x9d &&
      bytes[24] === 0x01 &&
      bytes[25] === 0x2a
    ) {
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }
  }
  if (mimeType === "image/svg+xml") {
    try {
      const svg = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const root = svg.match(/<svg\b([^>]*)>/i)?.[1];
      if (root === undefined) return undefined;
      const dimension = (name: string): number | undefined => {
        const value = root.match(
          new RegExp(`\\b${name}\\s*=\\s*["']([0-9]+(?:\\.[0-9]+)?)`, "i"),
        )?.[1];
        return value === undefined ? undefined : Number(value);
      };
      const width = dimension("width");
      const height = dimension("height");
      if (width !== undefined && height !== undefined) return { width, height };
      const viewBox = root
        .match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1]
        ?.trim()
        .split(/[\s,]+/)
        .map(Number);
      if (
        viewBox?.length === 4 &&
        viewBox.every(Number.isFinite) &&
        viewBox[2]! > 0 &&
        viewBox[3]! > 0
      ) {
        return { width: viewBox[2]!, height: viewBox[3]! };
      }
      return { width: 300, height: 150 };
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function embeddedImageErrors(
  markdown: string,
  path: string,
): ProtocolError[] {
  const errors: ProtocolError[] = [];
  const images =
    /data:(image\/(?:png|jpeg|webp)|image\/svg\+xml);base64,([A-Za-z0-9+/=]+)/gi;
  for (const match of markdown.matchAll(images)) {
    const mimeType = match[1]!.toLowerCase();
    const encoded = match[2]!;
    try {
      const dimensions = imageDimensions(mimeType, decodeBase64(encoded));
      if (encoded.length > 5 * 1024 * 1024) {
        errors.push({
          code: "resource_limit",
          path,
          message: "An embedded image may not exceed 5 MB encoded",
        });
      }
      if (
        dimensions === undefined ||
        dimensions.width <= 0 ||
        dimensions.height <= 0
      ) {
        errors.push({
          code: "invalid_image",
          path,
          message: "An embedded image must have a recognized format and dimensions",
        });
      } else if (dimensions.width * dimensions.height > 50_000_000) {
        errors.push({
          code: "resource_limit",
          path,
          message: "An embedded image may not exceed 50 megapixels",
        });
      }
    } catch {
      errors.push({
        code: "invalid_image",
        path,
        message: "An embedded image must contain valid base64 data",
      });
    }
  }
  return errors;
}

function countTaskItems(markdown: string): number {
  let count = 0;
  let fence:
    | {
        marker: "`" | "~";
        length: number;
      }
    | undefined;

  for (const line of markdown.split(/\r?\n/)) {
    const fenceMatch = line.match(/^[ \t]{0,3}(`{3,}|~{3,})/);
    if (fenceMatch !== null) {
      const delimiter = fenceMatch[1]!;
      const marker = delimiter[0] as "`" | "~";
      if (fence === undefined) {
        fence = { marker, length: delimiter.length };
      } else if (fence.marker === marker && delimiter.length >= fence.length) {
        fence = undefined;
      }
      continue;
    }
    if (
      fence === undefined &&
      /^[ \t]*[-+*][ \t]+\[[ xX]\](?=[ \t]|$)/.test(line)
    ) {
      count += 1;
    }
  }

  return count;
}

export const ProtocolCore = {
  countTaskItems,

  inspectVariableDependencyGraph(
    protocol: Protocol,
  ): VariableDependencyGraphInspection {
    return inspectVariableDependencyGraph(protocol);
  },

  inspectProtocol(
    input: unknown,
    resources: ProtocolResourceContext = {},
  ): ProtocolInspection {
    const result = protocolSchema.safeParse(input);
    if (!result.success) {
      const errors = result.error.issues.flatMap<ProtocolError>((issue) => {
        if (issue.code === "unrecognized_keys") {
          return issue.keys.map((key) => ({
            code: "unrecognized_field",
            path: [...issue.path, key].join("."),
            message: `Unrecognized field: ${key}`,
          }));
        }

        return [
          {
            code: issue.code,
            path: issue.path.join("."),
            message: issue.message,
          },
        ];
      });

      return {
        format: "invalid",
        playable: false,
        errors,
      };
    }

    const semanticErrors: ProtocolError[] = [];
    if ((resources.importedHtmlBytes ?? 0) > 30 * 1024 * 1024) {
      semanticErrors.push({
        code: "resource_limit",
        path: "importedHtml",
        message: "Imported HTML may not exceed 30 MB",
      });
    }
    if ((resources.publishedHtmlBytes ?? 0) > 25 * 1024 * 1024) {
      semanticErrors.push({
        code: "resource_limit",
        path: "publishedHtml",
        message: "Published HTML may not exceed 25 MB",
      });
    }
    for (const image of resources.images ?? []) {
      if (image.encodedBytes > 5 * 1024 * 1024) {
        semanticErrors.push({
          code: "resource_limit",
          path: image.path,
          message: "An embedded image may not exceed 5 MB encoded",
        });
      }
      if (image.pixels > 50_000_000) {
        semanticErrors.push({
          code: "resource_limit",
          path: image.path,
          message: "An embedded image may not exceed 50 megapixels",
        });
      }
    }
    const encoder = new TextEncoder();
    if (result.data.sections.length > 500) {
      semanticErrors.push({
        code: "resource_limit",
        path: "sections",
        message: "A Protocol may contain at most 500 Sections",
      });
    }
    if (result.data.variables.length > 250) {
      semanticErrors.push({
        code: "resource_limit",
        path: "variables",
        message: "A Protocol may contain at most 250 Variable Definitions",
      });
    }
    if (result.data.formulaTestCases.length > 100) {
      semanticErrors.push({
        code: "resource_limit",
        path: "formulaTestCases",
        message: "A Protocol may contain at most 100 Formula Test Cases",
      });
    }
    let totalMarkdownBytes = 0;
    for (const [index, section] of result.data.sections.entries()) {
      const markdownBytes = encoder.encode(section.markdown).byteLength;
      totalMarkdownBytes += markdownBytes;
      semanticErrors.push(
        ...embeddedImageErrors(
          section.markdown,
          `sections.${index}.markdown`,
        ),
      );
      if (markdownBytes > 200 * 1024) {
        semanticErrors.push({
          code: "resource_limit",
          path: `sections.${index}.markdown`,
          message: "Section Markdown may not exceed 200 KB",
        });
      }
      if (
        section.completionRequirement === "all-task-items" &&
        countTaskItems(section.markdown) === 0
      ) {
        semanticErrors.push({
          code: "missing_task_items",
          path: `sections.${index}.completionRequirement`,
          message:
            "A Task Item Completion Requirement needs at least one checklist Task Item",
        });
      }
    }
    if (totalMarkdownBytes > 5 * 1024 * 1024) {
      semanticErrors.push({
        code: "resource_limit",
        path: "sections",
        message: "Protocol Markdown may not exceed 5 MB",
      });
    }
    for (const [index, definition] of result.data.variables.entries()) {
      if (definition.kind === "derived" && definition.formula.length > 2_000) {
        semanticErrors.push({
          code: "resource_limit",
          path: `variables.${index}.formula`,
          message: "Formula source may not exceed 2,000 characters",
        });
      }
      if (definition.kind === "input" && definition.valueType === "numeric") {
        const minimum =
          definition.minimum === undefined
            ? undefined
            : new ProtocolDecimal(definition.minimum);
        const maximum =
          definition.maximum === undefined
            ? undefined
            : new ProtocolDecimal(definition.maximum);
        if (
          minimum !== undefined &&
          maximum !== undefined &&
          minimum.greaterThan(maximum)
        ) {
          semanticErrors.push({
            code: "invalid_variable_constraints",
            path: `variables.${index}`,
            message: "Numeric minimum may not exceed maximum",
          });
        }
        if (
          definition.defaultValue !== undefined &&
          ((minimum !== undefined &&
            new ProtocolDecimal(definition.defaultValue).lessThan(minimum)) ||
            (maximum !== undefined &&
              new ProtocolDecimal(definition.defaultValue).greaterThan(maximum)))
        ) {
          semanticErrors.push({
            code: "invalid_variable_default",
            path: `variables.${index}.defaultValue`,
            message: "Numeric default must satisfy its constraints",
          });
        }
      }
      if (definition.kind === "input" && definition.valueType === "enum") {
        if (new Set(definition.options).size !== definition.options.length) {
          semanticErrors.push({
            code: "invalid_variable_constraints",
            path: `variables.${index}.options`,
            message: "Enum options must be unique",
          });
        }
        if (
          definition.defaultValue !== undefined &&
          !definition.options.includes(definition.defaultValue)
        ) {
          semanticErrors.push({
            code: "invalid_variable_default",
            path: `variables.${index}.defaultValue`,
            message: "Enum default must be one of its options",
          });
        }
      }
    }
    const sectionIds = new Set<string>();
    for (const [index, section] of result.data.sections.entries()) {
      if (sectionIds.has(section.sectionId)) {
        semanticErrors.push({
          code: "duplicate_section",
          path: `sections.${index}.sectionId`,
          message: `Duplicate Section: ${section.sectionId}`,
        });
      }
      sectionIds.add(section.sectionId);
    }
    const variableIds = new Set<string>();
    for (const [index, definition] of result.data.variables.entries()) {
      if (variableIds.has(definition.id)) {
        semanticErrors.push({
          code: "duplicate_variable",
          path: `variables.${index}.id`,
          message: `Duplicate Variable Definition: ${definition.id}`,
        });
      }
      variableIds.add(definition.id);
    }
    const definitionsById = new Map(
      result.data.variables.map((definition) => [definition.id, definition]),
    );
    for (const [index, section] of result.data.sections.entries()) {
      if (
        section.duration.kind === "fixed" &&
        (new ProtocolDecimal(section.duration.seconds).lessThan(1) ||
          new ProtocolDecimal(section.duration.seconds).greaterThan(
            7 * 24 * 60 * 60,
          ))
      ) {
        semanticErrors.push({
          code: "invalid_duration",
          path: `sections.${index}.duration.seconds`,
          message: "A timed Section duration must be from 1 second through 7 days",
        });
      }
      if (section.duration.kind === "derived") {
        const definition = definitionsById.get(section.duration.variableId);
        if (
          definition === undefined ||
          (definition.kind === "input" && definition.valueType !== "numeric")
        ) {
          semanticErrors.push({
            code: "invalid_duration_variable",
            path: `sections.${index}.duration.variableId`,
            message: "A Section duration must reference a Numeric Variable",
          });
        }
      }
    }
    const dependencyGraph = inspectVariableDependencyGraph(result.data);
    semanticErrors.push(
      ...dependencyGraph.diagnostics.map(({ code, path, message }) => ({
        code,
        path,
        message,
      })),
    );

    const hasDerivedVariables = result.data.variables.some(
      (definition) => definition.kind === "derived",
    );
    const derivedVariableIds = result.data.variables
      .filter((definition) => definition.kind === "derived")
      .map((definition) => definition.id);
    const inputVariableIds = result.data.variables
      .filter((definition) => definition.kind === "input")
      .map((definition) => definition.id);
    if (hasDerivedVariables && result.data.formulaTestCases.length === 0) {
      semanticErrors.push({
        code: "missing_formula_test_case",
        path: "formulaTestCases",
        message:
          "A Protocol with Derived Variables requires a Formula Test Case",
      });
    }

    for (const [testIndex, testCase] of result.data.formulaTestCases.entries()) {
      for (const id of inputVariableIds) {
        if (!(id in testCase.inputValues)) {
          semanticErrors.push({
            code: "missing_input_value",
            path: `formulaTestCases.${testIndex}.inputValues.${id}`,
            message: `Formula Test Case is missing Input Variable: ${id}`,
          });
        }
      }
      for (const id of derivedVariableIds) {
        if (!(id in testCase.expectedDerivedValues)) {
          semanticErrors.push({
            code: "missing_expected_value",
            path: `formulaTestCases.${testIndex}.expectedDerivedValues.${id}`,
            message: `Formula Test Case is missing Derived Variable: ${id}`,
          });
        }
      }
      const evaluation = ProtocolCore.evaluateProtocol(
        result.data,
        testCase.inputValues,
      );
      if (!evaluation.ok) {
        semanticErrors.push(
          ...evaluation.errors.map((error) => ({
            ...error,
            path: `formulaTestCases.${testIndex}.${error.path}`,
          })),
        );
        continue;
      }
      for (const [id, expected] of Object.entries(
        testCase.expectedDerivedValues,
      )) {
        const actual = evaluation.values[id];
        const roundedActual =
          typeof actual === "string"
            ? canonicalDecimal(
                new ProtocolDecimal(actual).toDecimalPlaces(
                  testCase.precision,
                  Decimal.ROUND_HALF_EVEN,
                ),
              )
            : undefined;
        const roundedExpected = canonicalDecimal(
          new ProtocolDecimal(expected).toDecimalPlaces(
            testCase.precision,
            Decimal.ROUND_HALF_EVEN,
          ),
        );
        if (roundedActual !== roundedExpected) {
          semanticErrors.push({
            code: "formula_test_failed",
            path: `formulaTestCases.${testIndex}.expectedDerivedValues.${id}`,
            message: `Expected ${id} to be ${expected}, received ${String(actual)}`,
          });
        }
      }
    }

    return {
      format: "valid",
      playable: semanticErrors.length === 0,
      errors: semanticErrors,
    };
  },

  encodeEnvelope(envelope: Envelope): string {
    return bytesToBase64url(
      new TextEncoder().encode(JSON.stringify(envelope)),
    );
  },

  decodeEnvelope(encoded: string): EnvelopeDecodeResult {
    let input: unknown;
    try {
      const bytes = base64urlToBytes(encoded);
      input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      return {
        ok: false,
        errors: [
          {
            code: "invalid_envelope_encoding",
            path: "",
            message: "Envelope must be base64url-encoded UTF-8 JSON",
          },
        ],
      };
    }

    const result = envelopeSchema.safeParse(input);
    if (!result.success) {
      return {
        ok: false,
        errors: result.error.issues.map((issue) => ({
          code: issue.code,
          path: issue.path.join("."),
          message: issue.message,
        })),
      };
    }

    return { ok: true, envelope: result.data };
  },

  extractEnvelope(html: string): EnvelopeDecodeResult {
    if (new TextEncoder().encode(html).byteLength > 30 * 1024 * 1024) {
      return {
        ok: false,
        errors: [
          {
            code: "resource_limit",
            path: "importedHtml",
            message: "Imported HTML may not exceed 30 MB",
          },
        ],
      };
    }
    const pattern =
      /<script id="protocol-box-data" type="application\/octet-stream">([\s\S]*?)<\/script>/g;
    const matches = [...html.matchAll(pattern)];
    if (matches.length !== 1) {
      return {
        ok: false,
        errors: [
          {
            code:
              matches.length === 0
                ? "missing_data_block"
                : "ambiguous_data_block",
            path: "",
            message:
              matches.length === 0
                ? "Expected one Protocol Box data block"
                : "Expected exactly one Protocol Box data block",
          },
        ],
      };
    }

    return ProtocolCore.decodeEnvelope((matches[0]?.[1] ?? "").trim());
  },

  canonicalizeProtocol(protocol: Protocol): string {
    const canonical = canonicalize(protocol);
    if (canonical === undefined) {
      throw new Error("Protocol cannot be canonicalized");
    }
    return canonical;
  },

  async fingerprintProtocol(protocol: Protocol): Promise<string> {
    const canonical = ProtocolCore.canonicalizeProtocol(protocol);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonical),
    );
    return bytesToHex(new Uint8Array(digest));
  },

  async generateAuthorKeyPair(): Promise<CryptoKeyPair> {
    return crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );
  },

  async exportPrivateKeyPkcs8(privateKey: CryptoKey): Promise<string> {
    return bytesToBase64url(
      new Uint8Array(await crypto.subtle.exportKey("pkcs8", privateKey)),
    );
  },

  async exportPublicKeySpki(publicKey: CryptoKey): Promise<string> {
    return bytesToBase64url(
      new Uint8Array(await crypto.subtle.exportKey("spki", publicKey)),
    );
  },

  async importPrivateKeyPkcs8(encoded: string): Promise<CryptoKey> {
    try {
      return await crypto.subtle.importKey(
        "pkcs8",
        base64urlToBytes(encoded),
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"],
      );
    } catch (cause) {
      throw new ProtocolCoreFailure(
        "invalid_private_key",
        "privateKeyPkcs8",
        "Expected a PKCS#8 ECDSA P-256 private key",
        { cause },
      );
    }
  },

  async importPublicKeySpki(encoded: string): Promise<CryptoKey> {
    try {
      return await crypto.subtle.importKey(
        "spki",
        base64urlToBytes(encoded),
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["verify"],
      );
    } catch (cause) {
      throw new ProtocolCoreFailure(
        "invalid_public_key",
        "publicKeySpki",
        "Expected an SPKI ECDSA P-256 public key",
        { cause },
      );
    }
  },

  async signProtocol(
    protocol: Protocol,
    privateKey: CryptoKey,
    publicKey: CryptoKey,
  ): Promise<Signature> {
    const inspection = ProtocolCore.inspectProtocol(protocol);
    if (inspection.format !== "valid" || !inspection.playable) {
      throw new ProtocolCoreFailure(
        "protocol_not_playable",
        "protocol",
        "Only a Playable Protocol can be signed",
      );
    }
    const canonical = new TextEncoder().encode(
      ProtocolCore.canonicalizeProtocol(protocol),
    );
    const [signature, publicKeySpki] = await Promise.all([
      crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        privateKey,
        canonical,
      ),
      crypto.subtle.exportKey("spki", publicKey),
    ]);
    const keyId = await crypto.subtle.digest("SHA-256", publicKeySpki);

    return {
      algorithm: "ECDSA-P256-SHA256",
      publicKeySpki: bytesToBase64url(new Uint8Array(publicKeySpki)),
      keyId: bytesToHex(new Uint8Array(keyId)),
      value: bytesToBase64url(new Uint8Array(signature)),
    };
  },

  async verifyProtocol(
    protocol: Protocol,
    signature: Signature,
  ): Promise<"match" | "mismatch"> {
    const publicKeyBytes = base64urlToBytes(signature.publicKeySpki);
    const publicKey = await ProtocolCore.importPublicKeySpki(
      signature.publicKeySpki,
    );
    const keyId = bytesToHex(
      new Uint8Array(await crypto.subtle.digest("SHA-256", publicKeyBytes)),
    );
    if (keyId !== signature.keyId) {
      return "mismatch";
    }
    let signatureBytes: Uint8Array<ArrayBuffer>;
    try {
      signatureBytes = base64urlToBytes(signature.value);
    } catch (cause) {
      throw new ProtocolCoreFailure(
        "invalid_signature",
        "signature.value",
        "Expected a base64url-encoded ECDSA P-256 signature",
        { cause },
      );
    }
    const matches = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      signatureBytes,
      new TextEncoder().encode(ProtocolCore.canonicalizeProtocol(protocol)),
    );
    return matches ? "match" : "mismatch";
  },

  async inspectEnvelope(
    input: unknown,
    resources: ProtocolResourceContext = {},
  ): Promise<EnvelopeInspection> {
    const parsed = envelopeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        format: "invalid",
        signature: "unverified",
        playable: false,
        errors: parsed.error.issues.map((issue) => ({
          code: issue.code,
          path: issue.path.join("."),
          message: issue.message,
        })),
      };
    }
    if (parsed.data.documentKind === "protocol-box/application") {
      return {
        format: "valid",
        signature: "unverified",
        playable: false,
        errors: [],
      };
    }

    const protocolInspection = ProtocolCore.inspectProtocol(
      parsed.data.protocol,
      resources,
    );
    let signature: "match" | "mismatch";
    try {
      signature = await ProtocolCore.verifyProtocol(
        parsed.data.protocol,
        parsed.data.signature,
      );
    } catch (error) {
      if (!(error instanceof ProtocolCoreFailure)) throw error;
      return {
        format: "invalid",
        signature: "unverified",
        playable: false,
        protocol: parsed.data.protocol,
        errors: [
          ...protocolInspection.errors,
          {
            code: error.code,
            path: error.path,
            message: error.message,
          },
        ],
      };
    }
    return {
      ...protocolInspection,
      protocol: parsed.data.protocol,
      signature,
      playable: protocolInspection.playable,
    };
  },

  evaluateProtocol(
    protocol: Protocol,
    inputValues: Record<string, VariableValue>,
  ): ProtocolEvaluationResult {
    const errors: ProtocolError[] = [];
    const definitions = new Map<string, VariableDefinition>();
    for (const [index, definition] of protocol.variables.entries()) {
      if (definitions.has(definition.id)) {
        errors.push({
          code: "duplicate_variable",
          path: `variables.${index}.id`,
          message: `Duplicate Variable Definition: ${definition.id}`,
        });
      } else {
        definitions.set(definition.id, definition);
      }
    }

    for (const id of Object.keys(inputValues)) {
      const definition = definitions.get(id);
      if (definition?.kind !== "input") {
        errors.push({
          code: "unknown_input",
          path: `inputValues.${id}`,
          message: `Unknown Input Variable: ${id}`,
        });
      }
    }

    const values: Record<string, VariableValue> = {};
    const numericValues = new Map<string, Decimal>();
    for (const [index, definition] of protocol.variables.entries()) {
      if (definition.kind !== "input") continue;
      const supplied = inputValues[definition.id] ?? definition.defaultValue;
      if (supplied === undefined) {
        errors.push({
          code: "missing_input",
          path: `variables.${index}`,
          message: `Missing Input Variable: ${definition.id}`,
        });
        continue;
      }

      if (definition.valueType === "boolean") {
        if (typeof supplied !== "boolean") {
          errors.push({
            code: "invalid_input",
            path: `inputValues.${definition.id}`,
            message: `${definition.id} must be boolean`,
          });
        } else {
          values[definition.id] = supplied;
        }
        continue;
      }
      if (typeof supplied !== "string") {
        errors.push({
          code: "invalid_input",
          path: `inputValues.${definition.id}`,
          message: `${definition.id} must be a string`,
        });
        continue;
      }
      if (definition.valueType === "enum" && !definition.options.includes(supplied)) {
        errors.push({
          code: "invalid_input",
          path: `inputValues.${definition.id}`,
          message: `${definition.id} must be one of its declared options`,
        });
        continue;
      }
      if (definition.valueType === "numeric") {
        try {
          const numeric = new ProtocolDecimal(supplied);
          if (!numeric.isFinite()) throw new Error("Non-finite");
          if (
            definition.minimum !== undefined &&
            numeric.lessThan(definition.minimum)
          ) {
            throw new Error("Below minimum");
          }
          if (
            definition.maximum !== undefined &&
            numeric.greaterThan(definition.maximum)
          ) {
            throw new Error("Above maximum");
          }
          const normalized = canonicalDecimal(numeric);
          values[definition.id] = normalized;
          numericValues.set(definition.id, numeric);
        } catch {
          errors.push({
            code: "invalid_input",
            path: `inputValues.${definition.id}`,
            message: `${definition.id} must be a finite decimal within its constraints`,
          });
        }
      } else {
        values[definition.id] = supplied;
      }
    }

    const visiting = new Set<string>();
    const evaluateDerived = (id: string): Decimal => {
      const existing = numericValues.get(id);
      if (existing !== undefined) return existing;
      const definition = definitions.get(id);
      if (definition === undefined) {
        throw new FormulaFailure("unknown_variable", `Unknown variable: ${id}`);
      }
      if (definition.kind !== "derived") {
        throw new FormulaFailure(
          "non_numeric_variable",
          `Variable is not numeric: ${id}`,
        );
      }
      if (visiting.has(id)) {
        throw new FormulaFailure("cyclic_dependency", `Cyclic dependency: ${id}`);
      }
      visiting.add(id);
      try {
        const expression = new FormulaParser(
          tokenizeFormula(definition.formula),
        ).parse();
        const result = evaluateExpression(expression, evaluateDerived).toDecimalPlaces(
          definition.precision,
          Decimal.ROUND_HALF_EVEN,
        );
        numericValues.set(id, result);
        values[id] = canonicalDecimal(result);
        return result;
      } finally {
        visiting.delete(id);
      }
    };

    if (errors.length === 0) {
      for (const [index, definition] of protocol.variables.entries()) {
        if (definition.kind !== "derived") continue;
        try {
          evaluateDerived(definition.id);
        } catch (error) {
          const failure =
            error instanceof FormulaFailure
              ? error
              : new FormulaFailure("formula_error", "Formula evaluation failed");
          errors.push({
            code: failure.code,
            path: `variables.${index}.formula`,
            message: failure.message,
          });
        }
      }
    }

    return errors.length === 0
      ? { ok: true, values }
      : { ok: false, errors };
  },
};
