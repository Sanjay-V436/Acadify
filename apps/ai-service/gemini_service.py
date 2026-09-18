import json
import logging
import os
from typing import Literal

from dotenv import load_dotenv
from pydantic import BaseModel, Field

logger = logging.getLogger("acadify-ai-service")
load_dotenv()


class RecommendationAnalysis(BaseModel):
    faculty_id: str
    match_level: Literal["High", "Moderate", "Low"]
    why_matched: list[str] = Field(default_factory=list)
    why_not_higher: list[str] = Field(default_factory=list)
    technical_overlap: list[str] = Field(default_factory=list)
    domain_overlap: list[str] = Field(default_factory=list)
    missing_expertise: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    summary: str = ""
    recommendation_reason: str = ""


class RecommendationAnalysisResponse(BaseModel):
    recommendations: list[RecommendationAnalysis] = Field(default_factory=list)


class GeminiAnalysisService:
    def __init__(self) -> None:
        self.api_keys = [
            os.environ.get("GEMINI_API_KEY_1", "").strip(),
            os.environ.get("GEMINI_API_KEY_2", "").strip(),
        ]
        self.model = os.environ.get("GEMINI_MODEL", "").strip()

    def analyze(
        self,
        project_title: str,
        project_description: str,
        candidates: list[dict],
    ) -> RecommendationAnalysisResponse | None:
        if not self.model or not any(self.api_keys):
            logger.warning("[AI] Gemini analysis unavailable; using fallback")
            return None

        prompt = self._build_prompt(
            project_title,
            project_description,
            candidates,
        )

        for key_index, api_key in enumerate(self.api_keys):
            if not api_key:
                continue

            try:
                logger.info("[AI] Gemini analysis started")
                response = self._generate(api_key, prompt)
                analysis = self._parse_response(response)
                logger.info(
                    "[AI] Gemini recommendations returned: %d",
                    len(analysis.recommendations),
                )
                logger.info("[AI] Gemini analysis completed")
                return analysis
            except Exception:
                logger.warning("[AI] Gemini key %d failed", key_index + 1)

        logger.warning("[AI] Gemini analysis unavailable; using fallback")
        return None

    def _generate(self, api_key: str, prompt: str):
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        return client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=RecommendationAnalysisResponse,
                temperature=0.2,
                automatic_function_calling=types.AutomaticFunctionCallingConfig(
                    disable=True,
                ),
            ),
        )

    @staticmethod
    def _parse_response(response) -> RecommendationAnalysisResponse:
        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, RecommendationAnalysisResponse):
            return parsed

        response_text = getattr(response, "text", None)
        if not response_text:
            raise ValueError("Gemini returned an empty response")

        return RecommendationAnalysisResponse.model_validate_json(response_text)

    @staticmethod
    def _build_prompt(
        project_title: str,
        project_description: str,
        candidates: list[dict],
    ) -> str:
        candidate_json = json.dumps(candidates, ensure_ascii=True, indent=2)
        return f"""You are analyzing mentor compatibility for Acadify.

Use ONLY the factual information inside the supplied project and faculty data.
Do not invent expertise, publications, projects, certifications, experience,
research areas, or domain knowledge. If information is absent, say:
\"Not explicitly listed in the supplied faculty profile.\"
Do not claim that a faculty member has no experience unless the supplied data
establishes that fact.

Analyze every supplied candidate and return the strongest five candidates.
Make explanations specific to each candidate's supplied profile. Do not reuse
generic explanations when the profiles differ. Consider technical overlap,
domain overlap, project requirements, availability when supplied, and Chroma
semantic distance. Match levels are qualitative only: High, Moderate, or Low.
Do not generate percentages or probabilities.

Return JSON matching the required schema exactly. Every field must be present;
use empty arrays when there is no relevant information.

PROJECT:
{json.dumps({"project_title": project_title, "description": project_description}, ensure_ascii=True)}

FACULTY CANDIDATES:
{candidate_json}
"""
