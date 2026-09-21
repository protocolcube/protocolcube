import type { Locale } from "@/locales";
import type { Protocol } from "@/domain/protocol";

const exampleCopy = {
  en: {
    title: "Buffer preparation example",
    labels: {
      finalVolume: "Final volume (mL)",
      targetConcentration: "Target concentration (mM)",
      stockConcentration: "Stock concentration (mM)",
      stockVolume: "Stock volume (mL)",
      diluentVolume: "Diluent volume (mL)",
    },
    sections: [
      {
        title: "Review the calculation",
        markdown: `### Calculated volumes

Confirm the resolved values before preparing the buffer.

| Quantity | Variable Value |
| --- | --- |
| Stock solution | {{ stockVolume }} mL |
| Diluent | {{ diluentVolume }} mL |

This example demonstrates Formula behavior. Protocol Box does not validate units or scientific suitability.`,
      },
      {
        title: "Measure the stock solution",
        markdown: `Measure **{{ stockVolume }} mL** of the stock solution.

- Confirm the stock label.
- Use equipment appropriate for the calculated volume.`,
      },
      {
        title: "Add the diluent",
        markdown: `Add **{{ diluentVolume }} mL** of diluent to reach a final volume of **{{ finalVolume }} mL**.

- [ ] Confirm the final volume.
- [ ] Record experimental observations outside Protocol Box.`,
      },
    ],
    testTitle: "Standard dilution",
    testDescription: "100 mL at 10 mM from 100 mM stock",
  },
  "zh-CN": {
    title: "缓冲液配制示例",
    labels: {
      finalVolume: "最终体积（mL）",
      targetConcentration: "目标浓度（mM）",
      stockConcentration: "储备液浓度（mM）",
      stockVolume: "储备液体积（mL）",
      diluentVolume: "稀释液体积（mL）",
    },
    sections: [
      {
        title: "检查计算结果",
        markdown: `### 计算体积

配制缓冲液前，请确认已解析的变量值。

| 数量 | 变量值 |
| --- | --- |
| 储备液 | {{ stockVolume }} mL |
| 稀释液 | {{ diluentVolume }} mL |

本示例用于说明公式行为。Protocol Box 不验证单位换算或科学适用性。`,
      },
      {
        title: "量取储备液",
        markdown: `量取 **{{ stockVolume }} mL** 储备液。

- 确认储备液标签。
- 使用适合计算体积的设备。`,
      },
      {
        title: "加入稀释液",
        markdown: `加入 **{{ diluentVolume }} mL** 稀释液，使最终体积达到 **{{ finalVolume }} mL**。

- [ ] 确认最终体积。
- [ ] 在 Protocol Box 之外记录实验观察结果。`,
      },
    ],
    testTitle: "标准稀释",
    testDescription: "用 100 mM 储备液配制 100 mL、10 mM 缓冲液",
  },
} as const;

export function exampleProtocolTitle(locale: Locale): string {
  return exampleCopy[locale].title;
}

export function createBufferPreparationProtocol(
  locale: Locale,
  title = exampleProtocolTitle(locale),
): Protocol {
  const copy = exampleCopy[locale];
  return {
    protocolId: crypto.randomUUID(),
    title,
    sections: copy.sections.map((section, index) => ({
      sectionId: crypto.randomUUID(),
      title: section.title,
      markdown: section.markdown,
      duration: { kind: "untimed" },
      endAction: "wait",
      ...(index === copy.sections.length - 1
        ? { completionRequirement: "all-task-items" as const }
        : {}),
    })),
    variables: [
      {
        kind: "input",
        id: "finalVolume",
        label: copy.labels.finalVolume,
        valueType: "numeric",
        defaultValue: "100",
        minimum: "0.01",
      },
      {
        kind: "input",
        id: "targetConcentration",
        label: copy.labels.targetConcentration,
        valueType: "numeric",
        defaultValue: "10",
        minimum: "0",
      },
      {
        kind: "input",
        id: "stockConcentration",
        label: copy.labels.stockConcentration,
        valueType: "numeric",
        defaultValue: "100",
        minimum: "0.01",
      },
      {
        kind: "derived",
        id: "stockVolume",
        label: copy.labels.stockVolume,
        valueType: "numeric",
        formula:
          "round(finalVolume * targetConcentration / stockConcentration, 2)",
        precision: 2,
        roundingMode: "half-even",
      },
      {
        kind: "derived",
        id: "diluentVolume",
        label: copy.labels.diluentVolume,
        valueType: "numeric",
        formula: "round(finalVolume - stockVolume, 2)",
        precision: 2,
        roundingMode: "half-even",
      },
    ],
    formulaTestCases: [
      {
        testCaseId: crypto.randomUUID(),
        name: copy.testTitle,
        description: copy.testDescription,
        inputValues: {
          finalVolume: "100",
          targetConcentration: "10",
          stockConcentration: "100",
        },
        expectedDerivedValues: {
          stockVolume: "10",
          diluentVolume: "90",
        },
        precision: 2,
        roundingMode: "half-even",
      },
    ],
  };
}
