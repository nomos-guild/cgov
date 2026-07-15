import { useEffect, useState } from "react";
import type { SurveyDefinition } from "cip-179";
import {
  applyPresentation,
  fetchAnchorJson,
  getRenderabilityProblem,
} from "@/lib/cip179Content";

export function useCip179Presentation(source: SurveyDefinition | null) {
  const [definition, setDefinition] = useState(source);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const renderabilityProblem = source
      ? getRenderabilityProblem(source)
      : null;
    setDefinition(renderabilityProblem ? null : source);
    setError(renderabilityProblem);
    if (!source?.contentAnchor || renderabilityProblem) {
      return () => { active = false; };
    }
    void fetchAnchorJson(source.contentAnchor)
      .then((value) => {
        if (active) setDefinition(applyPresentation(source, value));
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => { active = false; };
  }, [source]);

  return { definition, error };
}
