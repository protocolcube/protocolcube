<script setup lang="ts">
import { storeToRefs } from "pinia";
import { BookOpen, CircleHelp, FileCheck2, Files } from "@lucide/vue";
import { useAuthorStore } from "@/features/author/store";
import { Button } from "@/components/ui/button";
import { t } from "@/locales";
type AuthorView = "drafts" | "authoring" | "publish";
defineProps<{ activeView: AuthorView }>();
const emit = defineEmits<{ navigate: [view: AuthorView]; help: [] }>();
const { editing } = storeToRefs(useAuthorStore());
</script>
<template>
<nav
  id="author-workspace-navigation"
  class="workspace-rail flex flex-col gap-1 border-r border-sidebar-border bg-[color-mix(in_oklab,var(--sidebar)_96%,transparent)] px-[.55rem] py-3 max-[48rem]:flex-row max-[48rem]:overflow-x-auto max-[48rem]:border-r-0 max-[48rem]:border-b max-[48rem]:p-1.5"
  :aria-label="t('author.nav.label')"
>
  <Button
    type="button"
    variant="ghost"
    class="h-auto min-h-[3.2rem] justify-start p-[.65rem] whitespace-normal text-sidebar-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-primary aria-[current=page]:shadow-[inset_3px_0_var(--sidebar-primary)] max-[48rem]:min-h-[2.4rem] max-[48rem]:flex-[1_0_auto] max-[48rem]:aria-[current=page]:shadow-[inset_0_-3px_var(--sidebar-primary)] max-[24rem]:min-w-10 max-[24rem]:justify-center max-[24rem]:[&_span]:hidden"
    :aria-current="activeView === 'drafts' ? 'page' : undefined"
    @click="emit('navigate', 'drafts')"
  >
    <Files aria-hidden="true" />
    <span>{{ t("author.nav.drafts") }}</span>
  </Button>
  <Button
    type="button"
    variant="ghost"
    class="h-auto min-h-[3.2rem] justify-start p-[.65rem] whitespace-normal text-sidebar-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-primary aria-[current=page]:shadow-[inset_3px_0_var(--sidebar-primary)] max-[48rem]:min-h-[2.4rem] max-[48rem]:flex-[1_0_auto] max-[48rem]:aria-[current=page]:shadow-[inset_0_-3px_var(--sidebar-primary)] max-[24rem]:min-w-10 max-[24rem]:justify-center max-[24rem]:[&_span]:hidden"
    :disabled="!editing"
    :aria-current="activeView === 'authoring' ? 'page' : undefined"
    @click="emit('navigate', 'authoring')"
  >
    <BookOpen aria-hidden="true" />
    <span>{{ t("author.nav.authoring") }}</span>
  </Button>
  <Button
    type="button"
    variant="ghost"
    class="h-auto min-h-[3.2rem] justify-start p-[.65rem] whitespace-normal text-sidebar-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-primary aria-[current=page]:shadow-[inset_3px_0_var(--sidebar-primary)] max-[48rem]:min-h-[2.4rem] max-[48rem]:flex-[1_0_auto] max-[48rem]:aria-[current=page]:shadow-[inset_0_-3px_var(--sidebar-primary)] max-[24rem]:min-w-10 max-[24rem]:justify-center max-[24rem]:[&_span]:hidden"
    :disabled="!editing"
    :aria-current="activeView === 'publish' ? 'page' : undefined"
    @click="emit('navigate', 'publish')"
  >
    <FileCheck2 aria-hidden="true" />
    <span>{{ t("author.nav.publish") }}</span>
  </Button>
  <Button
    type="button"
    variant="ghost"
    class="h-auto min-h-[3.2rem] justify-start p-[.65rem] whitespace-normal text-sidebar-foreground max-[48rem]:min-h-[2.4rem] max-[48rem]:flex-[1_0_auto] max-[24rem]:min-w-10 max-[24rem]:justify-center max-[24rem]:[&_span]:hidden"
    @click="emit('help')"
  >
    <CircleHelp aria-hidden="true" />
    <span>{{ t("common.help") }}</span>
  </Button>
</nav>

</template>
