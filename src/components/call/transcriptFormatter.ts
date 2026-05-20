export const formatCallTranscript = (
  rawTranscript: string | null | undefined,
  candidateName: string,
) => {
  if (typeof rawTranscript !== "string") {
    return "";
  }

  const agentReplacement = "**AI interviewer:**";
  const userReplacement = `**${candidateName}:**`;

  return rawTranscript
    .replace(/Agent:/g, agentReplacement)
    .replace(/User:/g, userReplacement)
    .replace(/(?:\r\n|\r|\n)/g, "\n\n");
};
