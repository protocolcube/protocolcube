<script setup lang="ts">
import {
  ArrowLeft,
  BookOpen,
  Database,
  KeyRound,
  Scale,
  ScanSearch,
  ShieldCheck,
  TriangleAlert,
} from "@lucide/vue";
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LocaleSelect from "@/components/shared/LocaleSelect.vue";
import {
  authorGuideContent,
  type AuthorChapterId,
  type AuthorScreenshotId,
} from "@/features/help/content/author-guide-content";
import { configuredHelpScreenshotUrl } from "@/features/help/content/help-screenshot-config";
import { locale, t, type TranslationKey } from "@/locales";

type HelpMode = "author" | "reader";
type TopicId =
  | "author"
  | "reader"
  | "glossary"
  | "security"
  | "keyboard"
  | "troubleshooting";

interface HelpTopic {
  id: TopicId;
  title: TranslationKey;
  summary: TranslationKey;
  modes: readonly HelpMode[] | "all";
}

const props = withDefaults(
  defineProps<{
    mode?: HelpMode;
    contextualEntry?: boolean;
  }>(),
  {
    mode: "reader",
    contextualEntry: false,
  },
);
const emit = defineEmits<{
  close: [];
}>();
const route = useRoute();
const router = useRouter();

const topics = [
  {
    id: "author",
    title: "help.topic.author",
    summary: "help.topic.author.summary",
    modes: ["author"],
  },
  {
    id: "reader",
    title: "help.topic.reader",
    summary: "help.topic.reader.summary",
    modes: ["reader"],
  },
  {
    id: "glossary",
    title: "help.topic.glossary",
    summary: "help.topic.glossary.summary",
    modes: "all",
  },
  {
    id: "security",
    title: "help.topic.security",
    summary: "help.topic.security.summary",
    modes: "all",
  },
  {
    id: "keyboard",
    title: "help.topic.keyboard",
    summary: "help.topic.keyboard.summary",
    modes: "all",
  },
  {
    id: "troubleshooting",
    title: "help.topic.troubleshooting",
    summary: "help.topic.troubleshooting.summary",
    modes: "all",
  },
] as const satisfies readonly HelpTopic[];

const readerSteps = [
  ["help.reader.step1.title", "help.reader.step1.body"],
  ["help.reader.step2.title", "help.reader.step2.body"],
  ["help.reader.step3.title", "help.reader.step3.body"],
  ["help.reader.step4.title", "help.reader.step4.body"],
  ["help.reader.step5.title", "help.reader.step5.body"],
] as const satisfies readonly (readonly [TranslationKey, TranslationKey])[];

const glossaryEntries = [
  ["help.glossary.protocol.term", "help.glossary.protocol.definition"],
  ["help.glossary.author.term", "help.glossary.author.definition"],
  ["help.glossary.reader.term", "help.glossary.reader.definition"],
  ["help.glossary.authorKey.term", "help.glossary.authorKey.definition"],
  ["help.glossary.authorKeyId.term", "help.glossary.authorKeyId.definition"],
  ["help.glossary.keyBundle.term", "help.glossary.keyBundle.definition"],
  [
    "help.glossary.keyBundlePassword.term",
    "help.glossary.keyBundlePassword.definition",
  ],
  [
    "help.glossary.recoveryCopy.term",
    "help.glossary.recoveryCopy.definition",
  ],
  [
    "help.glossary.trustedChannel.term",
    "help.glossary.trustedChannel.definition",
  ],
  ["help.glossary.section.term", "help.glossary.section.definition"],
  [
    "help.glossary.variableDefinition.term",
    "help.glossary.variableDefinition.definition",
  ],
  [
    "help.glossary.inputVariable.term",
    "help.glossary.inputVariable.definition",
  ],
  [
    "help.glossary.derivedVariable.term",
    "help.glossary.derivedVariable.definition",
  ],
  ["help.glossary.variableValue.term", "help.glossary.variableValue.definition"],
  [
    "help.glossary.playbackSession.term",
    "help.glossary.playbackSession.definition",
  ],
  [
    "help.glossary.completionSummary.term",
    "help.glossary.completionSummary.definition",
  ],
  [
    "help.glossary.unsignedDraft.term",
    "help.glossary.unsignedDraft.definition",
  ],
  ["help.glossary.authorPreview.term", "help.glossary.authorPreview.definition"],
  ["help.glossary.formulaTest.term", "help.glossary.formulaTest.definition"],
  [
    "help.glossary.signatureMatch.term",
    "help.glossary.signatureMatch.definition",
  ],
  [
    "help.glossary.signatureMismatch.term",
    "help.glossary.signatureMismatch.definition",
  ],
  ["help.glossary.playable.term", "help.glossary.playable.definition"],
  ["help.glossary.fingerprint.term", "help.glossary.fingerprint.definition"],
  ["help.glossary.published.term", "help.glossary.published.definition"],
  ["help.glossary.fork.term", "help.glossary.fork.definition"],
] as const satisfies readonly (readonly [TranslationKey, TranslationKey])[];

const securityWarnings = [
  "help.security.warning.loss",
  "help.security.warning.identity",
  "help.security.warning.evidence",
] as const satisfies readonly TranslationKey[];

const securitySections = [
  {
    icon: KeyRound,
    title: "help.security.custody.title",
    description: "help.security.custody.description",
    items: [
      "help.security.custody.password",
      "help.security.custody.recovery",
      "help.security.custody.lock",
      "help.security.custody.endpoint",
      "help.security.custody.revocation",
      "help.security.custody.compromise",
    ],
  },
  {
    icon: ScanSearch,
    title: "help.security.verification.title",
    description: "help.security.verification.description",
    items: [
      "help.security.verification.signature",
      "help.security.verification.replacement",
      "help.security.verification.channel",
    ],
  },
  {
    icon: Database,
    title: "help.security.localData.title",
    description: "help.security.localData.description",
    items: [
      "help.security.localData.drafts",
      "help.security.localData.playback",
      "help.security.localData.deletion",
    ],
  },
  {
    icon: Scale,
    title: "help.security.evidence.title",
    description: "help.security.evidence.description",
    items: [
      "help.security.evidence.summary",
      "help.security.evidence.network",
      "help.security.evidence.links",
    ],
  },
] as const satisfies readonly {
  icon: typeof KeyRound;
  title: TranslationKey;
  description: TranslationKey;
  items: readonly TranslationKey[];
}[];

const securityIdentifierRows = [
  {
    name: "help.security.identifiers.authorKey.name",
    identifies: "help.security.identifiers.authorKey.identifies",
    changes: "help.security.identifiers.authorKey.changes",
    limitation: "help.security.identifiers.authorKey.limitation",
  },
  {
    name: "help.security.identifiers.protocol.name",
    identifies: "help.security.identifiers.protocol.identifies",
    changes: "help.security.identifiers.protocol.changes",
    limitation: "help.security.identifiers.protocol.limitation",
  },
  {
    name: "help.security.identifiers.file.name",
    identifies: "help.security.identifiers.file.identifies",
    changes: "help.security.identifiers.file.changes",
    limitation: "help.security.identifiers.file.limitation",
  },
] as const satisfies readonly Record<
  "name" | "identifies" | "changes" | "limitation",
  TranslationKey
>[];

const securityRelatedLinks = [
  {
    label: "help.security.related.authorKey",
    path: "/help/author/author-key",
  },
  {
    label: "help.security.related.drafts",
    path: "/help/author/unsigned-draft",
  },
  {
    label: "help.security.related.publish",
    path: "/help/author/publish-recovery",
  },
  {
    label: "help.security.related.glossary",
    path: "/help/glossary",
  },
] as const satisfies readonly { label: TranslationKey; path: string }[];

const sharedKeyboardItems = [
  "help.keyboard.general",
  "help.keyboard.required",
] as const satisfies readonly TranslationKey[];

const authorKeyboardItems = [
  "help.keyboard.help",
  "help.keyboard.save",
  "help.keyboard.preview",
  "help.keyboard.panes",
] as const satisfies readonly TranslationKey[];

const readerKeyboardItems = [
  "help.keyboard.reader",
] as const satisfies readonly TranslationKey[];

const sharedTroubleshootingItems = [
  "help.troubleshooting.blocked",
  "help.troubleshooting.crypto",
  "help.troubleshooting.storage",
  "help.troubleshooting.timer",
  "help.troubleshooting.session",
] as const satisfies readonly TranslationKey[];

const routeHeading = ref<HTMLHeadingElement>();
const guide = computed(() => authorGuideContent[locale.value]);
const authorChapterId = computed<AuthorChapterId | undefined>(() => {
  const id =
    route.name === "help-author-chapter" &&
    typeof route.params.chapterId === "string"
      ? route.params.chapterId
      : undefined;
  return guide.value.chapters.some((chapter) => chapter.id === id)
    ? (id as AuthorChapterId)
    : undefined;
});
const authorChapter = computed(() =>
  guide.value.chapters.find(
    (chapter) => chapter.id === authorChapterId.value,
  ),
);

const availableTopics = computed(() =>
  topics.filter(
    (topic) =>
      topic.modes === "all" ||
      (topic.modes as readonly HelpMode[]).includes(props.mode),
  ),
);

const activeTopic = computed<HelpTopic | undefined>(() => {
  const id =
    route.name === "help-topic" ||
    route.name === "help-author" ||
    route.name === "help-author-chapter"
      ? typeof route.params.topic === "string"
        ? route.params.topic
        : route.name === "help-author" || route.name === "help-author-chapter"
          ? "author"
          : undefined
      : undefined;
  return topics.find((topic) => topic.id === id);
});

async function focusHeading(): Promise<void> {
  await nextTick();
  routeHeading.value?.focus();
}

function goBack(): void {
  if (props.contextualEntry) {
    emit("close");
    return;
  }
  if (authorChapter.value !== undefined) {
    void router.push({ name: "help-author", query: route.query });
    return;
  }
  if (activeTopic.value !== undefined) {
    void router.push({ name: "help", query: route.query });
    return;
  }
  emit("close");
}

function helpRoute(path: string): { path: string; query?: { from: string } } {
  const from = route.query.from;
  return typeof from === "string" ? { path, query: { from } } : { path };
}

function screenshotUrl(id: AuthorScreenshotId): string | undefined {
  return configuredHelpScreenshotUrl(id);
}

void focusHeading();

watch(
  () => route.fullPath,
  () => {
    void focusHeading();
  },
);
</script>

<template>
  <main
    class="min-w-0 min-h-dvh overflow-x-clip text-foreground [background:linear-gradient(90deg,color-mix(in_oklab,var(--border)_30%,transparent)_1px,transparent_1px)_0_0/3rem_3rem,var(--background)]"
  >
    <header
      class="sticky top-0 z-20 flex min-w-0 items-center justify-between gap-3 border-b border-border bg-[color-mix(in_oklab,var(--card)_94%,transparent)] px-[clamp(.75rem,3vw,1.5rem)] py-[.65rem] [backdrop-filter:blur(16px)] max-[24rem]:flex-col max-[24rem]:items-stretch max-[24rem]:[&>*]:max-w-full"
    >
      <Button type="button" size="sm" variant="ghost" @click="goBack">
        <ArrowLeft aria-hidden="true" />
        {{
          props.contextualEntry
            ? t("help.backWorkbench")
            : activeTopic === undefined
            ? t("help.backWorkbench")
            : t("help.backTopics")
        }}
      </Button>
      <LocaleSelect />
    </header>

    <article
      class="mx-auto w-[min(68rem,calc(100%-2rem))] min-w-0 pt-[clamp(1.5rem,5vw,4rem)] pb-20 max-[42rem]:w-[min(68rem,calc(100%-1.25rem))]"
    >
      <div
        class="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-[clamp(1rem,3vw,2rem)] border-b border-border pb-[clamp(1.5rem,4vw,3rem)] max-[42rem]:grid-cols-1"
      >
        <span
          class="grid min-h-18 [place-items:end_start] rounded-[.4rem] border border-primary p-[.65rem] font-mono text-[.68rem] font-extrabold tracking-[.08em] text-primary [writing-mode:vertical-rl] max-[42rem]:min-h-0 max-[42rem]:w-fit max-[42rem]:[writing-mode:horizontal-tb]"
          aria-hidden="true"
        >PB / HELP</span>
        <div>
          <p class="mb-[.35rem] text-[.72rem] font-[750] tracking-[.08em] text-primary uppercase">
            {{ props.mode === "author" ? t("help.topic.author") : t("help.topic.reader") }}
          </p>
          <h1
            ref="routeHeading"
            tabindex="-1"
            class="m-0 font-serif text-[clamp(2rem,7vw,4.5rem)] font-[650] leading-[.98] tracking-[-.045em] outline-none focus-visible:rounded focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_45%,transparent)]"
          >
            {{
              activeTopic === undefined
                ? t("help.title")
                : authorChapter?.title ?? t(activeTopic.title)
            }}
          </h1>
          <p class="mt-4 mb-0 max-w-[46rem] text-[clamp(.95rem,2vw,1.12rem)] leading-[1.65] text-muted-foreground">
            {{
              activeTopic === undefined
                ? t("help.subtitle")
                : authorChapter?.summary ?? t(activeTopic.summary)
            }}
          </p>
        </div>
      </div>

      <section
        v-if="activeTopic === undefined"
        class="mt-[clamp(2rem,5vw,4rem)]"
        aria-labelledby="help-topics-title"
      >
        <h2 id="help-topics-title" class="mb-4 text-[.8rem] tracking-[.08em] uppercase">
          {{ t("help.chooseTopic") }}
        </h2>
        <nav class="grid grid-cols-2 gap-[.85rem] max-[42rem]:grid-cols-1" :aria-label="t('help.chooseTopic')">
          <RouterLink
            v-for="topic in availableTopics"
            :key="topic.id"
            :to="helpRoute(`/help/${topic.id}`)"
            class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-[.85rem] rounded-[.55rem] border border-border bg-[color-mix(in_oklab,var(--card)_92%,transparent)] p-[1.1rem] text-inherit no-underline transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-primary hover:shadow-[0_.75rem_2rem_color-mix(in_oklab,var(--foreground)_8%,transparent)] focus-visible:outline-3 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            <BookOpen aria-hidden="true" class="mt-[.15rem] size-[1.1rem] text-primary" />
            <span class="min-w-0">
              <strong class="block wrap-anywhere font-serif text-[1.05rem]">
                {{ t(topic.title) }}
              </strong>
              <small class="mt-[.35rem] block wrap-anywhere text-[.82rem] leading-normal text-muted-foreground">
                {{ t(topic.summary) }}
              </small>
            </span>
          </RouterLink>
        </nav>
      </section>

      <section
        v-else-if="activeTopic.id === 'author'"
        class="mt-[clamp(2rem,5vw,4rem)] min-w-0"
      >
        <template v-if="authorChapter === undefined">
          <p class="mb-6 max-w-[52rem] text-base leading-[1.7] text-muted-foreground">
            {{ guide.summary }}
          </p>
          <div class="guide-home-section">
            <h2>{{ guide.quickStartTitle }}</h2>
            <ol class="quick-steps">
              <li
                v-for="(step, index) in guide.quickStart"
                :key="step.title"
              >
                <span aria-hidden="true">{{ index + 1 }}</span>
                <div>
                  <h3>{{ step.title }}</h3>
                  <p>{{ step.body }}</p>
                </div>
              </li>
            </ol>
          </div>

          <div class="guide-home-section">
            <h2>{{ guide.chaptersTitle }}</h2>
            <nav class="chapter-card-grid" :aria-label="guide.chaptersTitle">
              <RouterLink
                v-for="(chapter, index) in guide.chapters"
                :key="chapter.id"
                :to="helpRoute(`/help/author/${chapter.id}`)"
                class="chapter-card"
              >
                <span class="mono">{{ String(index + 1).padStart(2, "0") }}</span>
                <strong>{{ chapter.navTitle }}</strong>
                <small>{{ chapter.summary }}</small>
              </RouterLink>
            </nav>
          </div>

          <div class="guide-home-section publication-checklist">
            <h2>{{ guide.checklistTitle }}</h2>
            <ul>
              <li v-for="item in guide.checklist" :key="item">
                {{ item }}
              </li>
            </ul>
          </div>
        </template>

        <div v-else class="author-guide-layout">
          <nav class="chapter-navigation" :aria-label="guide.chaptersTitle">
            <RouterLink :to="helpRoute('/help/author')" class="chapter-navigation-home">
              {{ guide.title }}
            </RouterLink>
            <RouterLink
              v-for="(chapter, index) in guide.chapters"
              :key="chapter.id"
              :to="helpRoute(`/help/author/${chapter.id}`)"
              :aria-current="
                chapter.id === authorChapter.id ? 'page' : undefined
              "
            >
              <span>{{ String(index + 1).padStart(2, "0") }}</span>
              {{ chapter.navTitle }}
            </RouterLink>
          </nav>

          <article class="author-chapter">
            <div class="chapter-objective">
              <span>{{ guide.labels.objective }}</span>
              <p>{{ authorChapter.objective }}</p>
            </div>

            <div class="chapter-block">
              <h2>{{ guide.labels.uiMap }}</h2>
              <dl class="guide-map">
                <template v-for="item in authorChapter.uiMap" :key="item.label">
                  <dt>{{ item.label }}</dt>
                  <dd>
                    <span>{{ item.meaning }}</span>
                    <small>{{ item.action }}</small>
                  </dd>
                </template>
              </dl>
            </div>

            <div
              v-if="authorChapter.screenshotId"
              class="chapter-block screenshot-reference"
            >
              <div class="chapter-block-heading">
                <h2>{{ guide.labels.screenshot }}</h2>
                <a
                  v-if="screenshotUrl(authorChapter.screenshotId)"
                  :href="screenshotUrl(authorChapter.screenshotId)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ guide.labels.viewScreenshot }}
                </a>
                <span v-else>{{ guide.labels.screenshotUnavailable }}</span>
              </div>
              <ol class="screenshot-legend">
                <li
                  v-for="item in authorChapter.screenshotLegend"
                  :key="item.label"
                >
                  <span>{{ item.label }}</span>
                  <div>
                    <strong>{{ item.meaning }}</strong>
                    <small>{{ item.action }}</small>
                  </div>
                </li>
              </ol>
            </div>

            <div class="chapter-block">
              <h2>{{ guide.labels.steps }}</h2>
              <ol class="chapter-steps">
                <li
                  v-for="(step, index) in authorChapter.steps"
                  :key="step.title"
                >
                  <span>{{ index + 1 }}</span>
                  <div>
                    <h3>{{ step.title }}</h3>
                    <p>{{ step.body }}</p>
                  </div>
                </li>
              </ol>
            </div>

            <details class="chapter-reference">
              <summary>{{ guide.labels.states }}</summary>
              <div class="guide-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{{ guide.labels.tableState }}</th>
                      <th>{{ guide.labels.tableMeaning }}</th>
                      <th>{{ guide.labels.tableAction }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in authorChapter.states" :key="item.label">
                      <th scope="row">{{ item.label }}</th>
                      <td>{{ item.meaning }}</td>
                      <td>{{ item.action }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>

            <div class="chapter-block">
              <h2>{{ guide.labels.examples }}</h2>
              <div class="guide-examples">
                <article
                  v-for="example in authorChapter.examples"
                  :key="example.title"
                >
                  <h3>{{ example.title }}</h3>
                  <p>{{ example.body }}</p>
                  <pre v-if="example.code"><code>{{ example.code }}</code></pre>
                </article>
              </div>
            </div>

            <details class="chapter-reference troubleshooting-cards">
              <summary>{{ guide.labels.troubleshooting }}</summary>
              <article
                v-for="item in authorChapter.troubleshooting"
                :key="item.title"
              >
                <h3>{{ item.title }}</h3>
                <p>{{ item.body }}</p>
              </article>
            </details>

            <nav class="related-chapters" :aria-label="guide.labels.related">
              <strong>{{ guide.labels.related }}</strong>
              <RouterLink
                v-for="relatedId in authorChapter.related"
                :key="relatedId"
                :to="helpRoute(`/help/author/${relatedId}`)"
              >
                {{
                  guide.chapters.find(chapter => chapter.id === relatedId)
                    ?.navTitle
                }}
              </RouterLink>
              <RouterLink
                v-if="authorChapter.id === 'author-key'"
                :to="helpRoute('/help/security')"
              >
                {{ t("help.security.related.security") }}
              </RouterLink>
            </nav>
          </article>
        </div>
      </section>

      <section v-else-if="activeTopic.id === 'reader'" class="mt-[clamp(2rem,5vw,4rem)] min-w-0">
        <p class="mb-6 max-w-[52rem] text-base leading-[1.7] text-muted-foreground">
          {{ t("help.reader.intro") }}
        </p>
        <ol class="m-0 grid list-none p-0">
          <li
            v-for="([title, body], index) in readerSteps"
            :key="title"
            class="grid grid-cols-[2.4rem_minmax(0,1fr)] gap-4 border-t border-border py-5 last:border-b"
          >
            <span
              aria-hidden="true"
              class="grid size-8 place-items-center rounded-full border border-primary font-mono text-xs font-[750] text-primary"
            >{{ index + 1 }}</span>
            <div>
              <h2 class="m-0 font-serif text-[1.2rem]">{{ t(title) }}</h2>
              <p class="mt-[.4rem] mb-0 leading-[1.65] text-muted-foreground">
                {{ t(body) }}
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section v-else-if="activeTopic.id === 'glossary'" class="mt-[clamp(2rem,5vw,4rem)] min-w-0">
        <p class="mb-6 max-w-[52rem] text-base leading-[1.7] text-muted-foreground">
          {{ t("help.glossary.intro") }}
        </p>
        <dl class="m-0 grid grid-cols-[minmax(9rem,.35fr)_minmax(0,1fr)] border-t border-border max-[42rem]:grid-cols-1">
          <template v-for="[term, definition] in glossaryEntries" :key="term">
            <dt class="min-w-0 border-b border-border py-[.95rem] pr-6 font-serif font-bold wrap-anywhere max-[42rem]:border-b-0 max-[42rem]:pb-1">
              {{ t(term) }}
            </dt>
            <dd class="m-0 min-w-0 border-b border-border py-[.95rem] leading-normal text-muted-foreground wrap-anywhere max-[42rem]:pt-0">
              {{ t(definition) }}
            </dd>
          </template>
        </dl>
      </section>

      <section v-else-if="activeTopic.id === 'security'" class="mt-[clamp(2rem,5vw,4rem)] min-w-0">
        <div class="mb-6 flex max-w-[52rem] items-start gap-3 text-base leading-[1.7] text-muted-foreground">
          <ShieldCheck aria-hidden="true" class="mt-[.15rem] size-5 shrink-0 text-primary" />
          <p class="m-0">{{ t("help.security.intro") }}</p>
        </div>

        <Alert variant="destructive" class="mb-6">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{{ t("help.security.warning.title") }}</AlertTitle>
          <AlertDescription>
            <ul class="mt-2 grid gap-2 pl-5">
              <li v-for="warning in securityWarnings" :key="warning">
                {{ t(warning) }}
              </li>
            </ul>
          </AlertDescription>
        </Alert>

        <div class="grid min-w-0 gap-4 md:grid-cols-2">
          <Card
            v-for="section in securitySections"
            :key="section.title"
            class="min-w-0"
          >
            <CardHeader>
              <div class="flex items-center gap-2">
                <component
                  :is="section.icon"
                  aria-hidden="true"
                  class="size-4 text-primary"
                />
                <CardTitle>{{ t(section.title) }}</CardTitle>
              </div>
              <CardDescription>{{ t(section.description) }}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul class="m-0 grid gap-3 pl-5 text-sm leading-[1.65]">
                <li v-for="item in section.items" :key="item">
                  {{ t(item) }}
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <section class="mt-8 min-w-0" aria-labelledby="security-identifiers-title">
          <h2 id="security-identifiers-title" class="font-serif text-2xl">
            {{ t("help.security.identifiers.title") }}
          </h2>
          <p class="max-w-[52rem] leading-[1.65] text-muted-foreground">
            {{ t("help.security.identifiers.intro") }}
          </p>
          <ScrollArea orientation="horizontal" class="mt-4 w-full">
            <Table class="min-w-[52rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>{{ t("help.security.identifiers.name") }}</TableHead>
                  <TableHead>{{ t("help.security.identifiers.identifies") }}</TableHead>
                  <TableHead>{{ t("help.security.identifiers.changes") }}</TableHead>
                  <TableHead>{{ t("help.security.identifiers.limitation") }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in securityIdentifierRows" :key="row.name">
                  <TableCell class="font-medium">{{ t(row.name) }}</TableCell>
                  <TableCell>{{ t(row.identifies) }}</TableCell>
                  <TableCell>{{ t(row.changes) }}</TableCell>
                  <TableCell>{{ t(row.limitation) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollArea>
        </section>

        <details class="chapter-reference mt-8">
          <summary>{{ t("help.security.crypto.title") }}</summary>
          <div class="grid gap-3 text-sm leading-[1.65]">
            <p>{{ t("help.security.crypto.intro") }}</p>
            <ul class="m-0 grid gap-2 pl-5">
              <li>{{ t("help.security.crypto.bundle") }}</li>
              <li>{{ t("help.security.crypto.drafts") }}</li>
              <li>{{ t("help.security.crypto.limit") }}</li>
            </ul>
          </div>
        </details>

        <nav
          class="related-chapters mt-8"
          :aria-label="t('help.security.related.title')"
        >
          <strong>{{ t("help.security.related.title") }}</strong>
          <RouterLink
            v-for="link in securityRelatedLinks"
            :key="link.path"
            :to="helpRoute(link.path)"
          >
            {{ t(link.label) }}
          </RouterLink>
        </nav>
      </section>

      <section v-else-if="activeTopic.id === 'keyboard'" class="mt-[clamp(2rem,5vw,4rem)] min-w-0">
        <p class="mb-6 max-w-[52rem] text-base leading-[1.7] text-muted-foreground">
          {{ t("help.keyboard.intro") }}
        </p>
        <ul class="m-0 grid list-none gap-3 p-0">
          <li
            v-for="item in sharedKeyboardItems"
            :key="item"
            class="relative rounded-[.5rem] border border-border bg-[color-mix(in_oklab,var(--card)_90%,transparent)] px-4 py-4 pl-9 leading-[1.65] wrap-anywhere before:absolute before:top-[1.35rem] before:left-4 before:size-[.45rem] before:rounded-full before:bg-primary before:content-['']"
          >
            {{ t(item) }}
          </li>
          <li
            v-for="item in props.mode === 'author'
              ? authorKeyboardItems
              : readerKeyboardItems"
            :key="item"
            class="relative rounded-[.5rem] border border-border bg-[color-mix(in_oklab,var(--card)_90%,transparent)] px-4 py-4 pl-9 leading-[1.65] wrap-anywhere before:absolute before:top-[1.35rem] before:left-4 before:size-[.45rem] before:rounded-full before:bg-primary before:content-['']"
          >
            {{ t(item) }}
          </li>
        </ul>
      </section>

      <section v-else class="mt-[clamp(2rem,5vw,4rem)] min-w-0">
        <p class="mb-6 max-w-[52rem] text-base leading-[1.7] text-muted-foreground">
          {{ t("help.troubleshooting.intro") }}
        </p>
        <ul class="m-0 grid list-none gap-3 p-0">
          <li
            v-for="item in sharedTroubleshootingItems"
            :key="item"
            class="relative rounded-[.5rem] border border-border bg-[color-mix(in_oklab,var(--card)_90%,transparent)] px-4 py-4 pl-9 leading-[1.65] wrap-anywhere before:absolute before:top-[1.35rem] before:left-4 before:size-[.45rem] before:rounded-full before:bg-primary before:content-['']"
          >
            {{ t(item) }}
          </li>
          <li
            v-if="props.mode === 'author'"
            class="relative rounded-[.5rem] border border-border bg-[color-mix(in_oklab,var(--card)_90%,transparent)] px-4 py-4 pl-9 leading-[1.65] wrap-anywhere before:absolute before:top-[1.35rem] before:left-4 before:size-[.45rem] before:rounded-full before:bg-primary before:content-['']"
          >
            {{ t("help.troubleshooting.author") }}
          </li>
        </ul>
        <div
          v-if="props.mode === 'author'"
          class="guide-table-scroll troubleshooting-matrix"
        >
          <table :aria-label="guide.labels.troubleshooting">
            <thead>
              <tr>
                <th>{{ guide.chaptersTitle }}</th>
                <th>{{ guide.labels.tableState }}</th>
                <th>{{ guide.labels.tableAction }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="chapter in guide.chapters" :key="chapter.id">
                <tr
                  v-for="(item, index) in chapter.troubleshooting"
                  :key="item.title"
                >
                  <th v-if="index === 0" scope="rowgroup" :rowspan="chapter.troubleshooting.length">
                    <RouterLink :to="helpRoute(`/help/author/${chapter.id}`)">
                      {{ chapter.navTitle }}
                    </RouterLink>
                  </th>
                  <td>{{ item.title }}</td>
                  <td>{{ item.body }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>
    </article>
  </main>
</template>

<style scoped>

.quick-steps {
  padding: 0;
  margin: 0;
  list-style: none;
}

.quick-steps {
  display: grid;
  gap: 0;
  counter-reset: help-step;
}

.quick-steps li {
  display: grid;
  grid-template-columns: 2.4rem minmax(0, 1fr);
  gap: 1rem;
  padding: 1.25rem 0;
  border-top: 1px solid var(--border);
}

.quick-steps li:last-child {
  border-bottom: 1px solid var(--border);
}

.quick-steps li > span {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1px solid var(--primary);
  border-radius: 50%;
  color: var(--primary);
  font-family: ui-monospace, "SFMono-Regular", Consolas, monospace;
  font-size: 0.75rem;
  font-weight: 750;
}

.quick-steps h2,
.quick-steps h3 {
  margin: 0;
  font-family: ui-serif, Charter, "Noto Serif CJK SC", serif;
  font-size: 1.2rem;
}

.quick-steps p {
  margin: 0.4rem 0 0;
  color: var(--muted-foreground);
  line-height: 1.65;
}

.guide-home-section + .guide-home-section {
  margin-top: 3rem;
}

.guide-home-section > h2,
.chapter-block > h2,
.chapter-block-heading > h2 {
  margin: 0 0 1rem;
  color: var(--muted-foreground);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.chapter-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.chapter-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.25rem 0.75rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: inherit;
  background: var(--card);
  text-decoration: none;
}

.chapter-card:hover {
  border-color: var(--primary);
}

.chapter-card:focus-visible {
  outline: 3px solid var(--ring);
  outline-offset: 2px;
}

.chapter-card > span {
  grid-row: 1 / 3;
  color: var(--primary);
  font-size: 0.72rem;
}

.chapter-card small {
  color: var(--muted-foreground);
  line-height: 1.45;
}

.publication-checklist {
  padding: 1.1rem;
  border: 1px solid var(--border);
  border-top: 3px solid var(--primary);
  border-radius: var(--radius);
  background: var(--card);
}

.publication-checklist ul {
  display: grid;
  gap: 0.65rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.publication-checklist li {
  position: relative;
  padding-left: 1.7rem;
  line-height: 1.55;
}

.publication-checklist li::before {
  position: absolute;
  top: 0.15rem;
  left: 0;
  display: grid;
  width: 1.1rem;
  height: 1.1rem;
  place-items: center;
  border: 1px solid var(--primary);
  color: var(--primary);
  content: "✓";
  font-size: 0.7rem;
}

.author-guide-layout {
  display: grid;
  grid-template-columns: 13rem minmax(0, 1fr);
  gap: clamp(1.5rem, 4vw, 3.5rem);
  align-items: start;
}

.chapter-navigation {
  position: sticky;
  top: 4.5rem;
  display: grid;
  max-height: calc(100dvh - 6rem);
  gap: 0.15rem;
  overflow: auto;
}

.chapter-navigation a {
  display: grid;
  grid-template-columns: 1.6rem minmax(0, 1fr);
  gap: 0.35rem;
  padding: 0.5rem;
  border-left: 2px solid transparent;
  color: var(--muted-foreground);
  font-size: 0.76rem;
  line-height: 1.35;
  text-decoration: none;
}

.chapter-navigation a:hover,
.chapter-navigation a[aria-current="page"] {
  border-left-color: var(--primary);
  color: var(--foreground);
  background: color-mix(in oklab, var(--primary) 7%, transparent);
}

.chapter-navigation a:focus-visible {
  outline: 3px solid var(--ring);
  outline-offset: -3px;
}

.chapter-navigation a.chapter-navigation-home {
  display: block;
  margin-bottom: 0.45rem;
  color: var(--primary);
  font-weight: 800;
}

.author-chapter {
  min-width: 0;
}

.chapter-objective {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
  padding: 1rem;
  border-left: 4px solid var(--primary);
  background: color-mix(in oklab, var(--primary) 7%, var(--card));
}

.chapter-objective span {
  color: var(--primary);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.chapter-objective p {
  margin: 0;
  line-height: 1.6;
}

.chapter-block,
.chapter-reference,
.related-chapters {
  margin-top: 2.25rem;
}

.guide-map {
  display: grid;
  grid-template-columns: minmax(9rem, 0.3fr) minmax(0, 1fr);
  margin: 0;
  border-top: 1px solid var(--border);
}

.guide-map dt,
.guide-map dd {
  padding: 0.85rem 0;
  margin: 0;
  border-bottom: 1px solid var(--border);
}

.guide-map dt {
  padding-right: 1rem;
  font-weight: 750;
}

.guide-map dd {
  display: grid;
  gap: 0.25rem;
}

.guide-map small {
  color: var(--muted-foreground);
  line-height: 1.45;
}

.chapter-block-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.chapter-block-heading > h2 {
  margin: 0;
}

.chapter-block-heading > a,
.chapter-block-heading > span {
  font-size: 0.75rem;
}

.chapter-block-heading > a {
  color: var(--primary);
  font-weight: 700;
  text-underline-offset: 0.2em;
}

.chapter-block-heading > span {
  color: var(--muted-foreground);
}

.troubleshooting-matrix {
  margin-top: 1.25rem;
}

.screenshot-reference {
  padding: 1rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  background: color-mix(in oklab, var(--card) 80%, transparent);
}

.screenshot-legend,
.chapter-steps {
  display: grid;
  gap: 0;
  padding: 0;
  margin: 0;
  list-style: none;
}

.screenshot-legend {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.screenshot-legend li {
  display: grid;
  grid-template-columns: 1.8rem minmax(0, 1fr);
  gap: 0.6rem;
}

.screenshot-legend li > span,
.chapter-steps li > span {
  display: grid;
  width: 1.7rem;
  height: 1.7rem;
  place-items: center;
  border-radius: 50%;
  color: var(--primary-foreground);
  background: var(--primary);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.7rem;
  font-weight: 800;
}

.screenshot-legend strong,
.screenshot-legend small {
  display: block;
}

.screenshot-legend small {
  margin-top: 0.2rem;
  color: var(--muted-foreground);
  line-height: 1.4;
}

.chapter-steps li {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  gap: 0.8rem;
  padding: 1rem 0;
  border-top: 1px solid var(--border);
}

.chapter-steps li:last-child {
  border-bottom: 1px solid var(--border);
}

.chapter-steps h3,
.chapter-steps p {
  margin: 0;
}

.chapter-steps h3 {
  font-family: ui-serif, Charter, "Noto Serif CJK SC", serif;
  font-size: 1.05rem;
}

.chapter-steps p {
  margin-top: 0.35rem;
  color: var(--muted-foreground);
  line-height: 1.6;
}

.chapter-reference {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
}

.chapter-reference > summary {
  padding: 0.85rem 1rem;
  cursor: pointer;
  font-weight: 750;
}

.chapter-reference[open] > summary {
  border-bottom: 1px solid var(--border);
}

.guide-table-scroll {
  overflow-x: auto;
}

.guide-table-scroll table {
  width: 100%;
  min-width: 38rem;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.guide-table-scroll th,
.guide-table-scroll td {
  padding: 0.75rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.guide-table-scroll thead th {
  color: var(--muted-foreground);
  background: var(--muted);
  font-size: 0.68rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.guide-examples {
  display: grid;
  gap: 0.7rem;
}

.guide-examples article,
.troubleshooting-cards article {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: color-mix(in oklab, var(--card) 88%, transparent);
}

.guide-examples h3,
.guide-examples p,
.troubleshooting-cards h3,
.troubleshooting-cards p {
  margin: 0;
}

.guide-examples p,
.troubleshooting-cards p {
  margin-top: 0.35rem;
  color: var(--muted-foreground);
  line-height: 1.55;
}

.guide-examples pre {
  padding: 0.75rem;
  margin: 0.75rem 0 0;
  overflow-x: auto;
  border-radius: calc(var(--radius) - 2px);
  background: var(--muted);
  white-space: pre-wrap;
}

.guide-examples code {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.76rem;
}

.troubleshooting-cards article {
  margin: 0.75rem;
  border-left: 3px solid var(--warning);
}

.related-chapters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  font-size: 0.78rem;
}

.related-chapters a {
  padding: 0.35rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--primary);
  text-decoration: none;
}

.related-chapters a:hover {
  border-color: var(--primary);
}

@media (max-width: 56rem) {
  .author-guide-layout {
    grid-template-columns: 1fr;
  }

  .chapter-navigation {
    position: sticky;
    z-index: 10;
    top: 3.8rem;
    display: flex;
    max-width: 100%;
    min-height: 2.8rem;
    overflow-x: auto;
    background: var(--background);
  }

  .chapter-navigation a {
    display: flex;
    flex: 0 0 auto;
    border-bottom: 2px solid transparent;
    border-left: 0;
    white-space: nowrap;
  }

  .chapter-navigation a:hover,
  .chapter-navigation a[aria-current="page"] {
    border-bottom-color: var(--primary);
    border-left-color: transparent;
  }

  .chapter-navigation a.chapter-navigation-home {
    display: block;
    margin: 0;
  }
}

@media (max-width: 42rem) {
  .chapter-card-grid,
  .screenshot-legend {
    grid-template-columns: 1fr;
  }

  .chapter-objective,
  .guide-map {
    grid-template-columns: 1fr;
  }

  .guide-map dt {
    padding-bottom: 0.25rem;
    border-bottom: 0;
  }

  .guide-map dd {
    padding-top: 0;
  }
}
</style>
