import claude from '@lobehub/icons-static-svg/icons/claude-color.svg?raw';
import deepseek from '@lobehub/icons-static-svg/icons/deepseek-color.svg?raw';
import gemini from '@lobehub/icons-static-svg/icons/gemini-color.svg?raw';
import grok from '@lobehub/icons-static-svg/icons/grok.svg?raw';
import kimi from '@lobehub/icons-static-svg/icons/kimi.svg?raw';
import nvidia from '@lobehub/icons-static-svg/icons/nvidia-color.svg?raw';
import openai from '@lobehub/icons-static-svg/icons/openai.svg?raw';
import perplexity from '@lobehub/icons-static-svg/icons/perplexity-color.svg?raw';
import zai from '@lobehub/icons-static-svg/icons/zai.svg?raw';
import styles from './ModelLogo.module.css';

// Each model shows its maker's logo (LobeHub icons, MIT). Single-colour ones follow the text
// colour, so they read in both themes; that is why the SVG is inlined rather than an <img>.
const LOGOS: [RegExp, string][] = [
  [/^gpt-|^o\d/, openai],
  [/^gemini-/, gemini],
  [/^claude-/, claude],
  [/^xai\/|grok/, grok],
  [/kimi/, kimi],
  [/glm/, zai],
  [/deepseek/, deepseek],
  [/nemotron/, nvidia],
];

const PROVIDER_LOGOS: Record<string, string> = {
  OPENAI: openai,
  GEMINI: gemini,
  ANTHROPIC: claude,
  PERPLEXITY: perplexity,
};

export function ModelLogo({ model, provider }: { model?: string; provider?: string }) {
  const svg =
    (model && LOGOS.find(([pattern]) => pattern.test(model))?.[1]) ??
    (provider && PROVIDER_LOGOS[provider]);
  if (!svg) return null;
  // Static files from the icon package, not user content.
  return (
    <span className={styles.logo} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
