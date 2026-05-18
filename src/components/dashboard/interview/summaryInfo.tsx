"use client";

import { Interview } from "@/types/interview";
import { Interviewer } from "@/types/interviewer";
import { Response } from "@/types/response";
import React, { useEffect, useState } from "react";
import { UserCircleIcon, SmileIcon, Info } from "lucide-react";
import { useInterviewers } from "@/contexts/interviewers.context";
// PieChart replaced by inline pure-SVG DonutChart below (zero-dep, deuteranopia-aware palette).
// Note: PieChart's hover-shimmer (highlightScope/faded) is intentionally not ported —
// these are static summary charts; no interactivity beyond hover-tooltip is needed.

/**
 * Pure-SVG donut chart. Each slice gets a <title> for screen-reader + hover tooltip.
 * Replaces @mui/x-charts PieChart usage. Drops 750KB of MUI bundle weight (with @mui/material).
 */
function DonutChart({
  data,
  size = 120,
  innerRadius = 0.55,
  className,
}: {
  data: { value: number; label: string; color: string }[];
  size?: number;
  innerRadius?: number;
  className?: string;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (total === 0) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-muted-foreground ${className ?? ""}`}
        style={{ width: size + 200, height: size }}
      >
        No data yet
      </div>
    );
  }
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;
  const ir = r * innerRadius;
  let start = -Math.PI / 2;
  const arcs = data
    .filter((d) => d.value > 0)
    .map((d, i) => {
      const angle = (d.value / total) * 2 * Math.PI;
      const end = start + angle;
      const x1 = cx + r * Math.cos(start);
      const y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end);
      const y2 = cy + r * Math.sin(end);
      const xi1 = cx + ir * Math.cos(end);
      const yi1 = cy + ir * Math.sin(end);
      const xi2 = cx + ir * Math.cos(start);
      const yi2 = cy + ir * Math.sin(start);
      const largeArc = angle > Math.PI ? 1 : 0;
      const path = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${ir} ${ir} 0 ${largeArc} 0 ${xi2} ${yi2} Z`;
      start = end;
      return (
        <path key={i} d={path} fill={d.color}>
          <title>{`${d.label} — ${Math.round((d.value / total) * 100)}%`}</title>
        </path>
      );
    });
  return (
    <div
      className={`flex flex-row items-center gap-3 ${className ?? ""}`}
      style={{ minHeight: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        {arcs}
      </svg>
      <ul className="text-xs flex flex-col gap-1">
        {data.map((d, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: d.color }}
              aria-hidden="true"
            />
            <span>{d.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
import { CandidateStatus } from "@/lib/enum";
import { convertSecondstoMMSS } from "@/lib/utils";
import Image from "next/image";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import DataTable, {
  TableData,
} from "@/components/dashboard/interview/dataTable";
import { ScrollArea } from "@/components/ui/scroll-area";

type SummaryProps = {
  responses: Response[];
  interview: Interview | undefined;
};

function InfoTooltip({ content }: { content: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Info
            className="h-2 w-2 text-brand-bold inline-block ml-0 align-super font-bold"
            strokeWidth={2.5}
          />
        </TooltipTrigger>
        <TooltipContent className="bg-gray-500 text-white font-normal">
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SummaryInfo({ responses, interview }: SummaryProps) {
  const { interviewers } = useInterviewers();
  const [interviewer, setInterviewer] = useState<Interviewer>();
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [completedInterviews, setCompletedInterviews] = useState<number>(0);
  const [sentimentCount, setSentimentCount] = useState({
    positive: 0,
    negative: 0,
    neutral: 0,
  });
  const [callCompletion, setCallCompletion] = useState({
    complete: 0,
    incomplete: 0,
    partial: 0,
  });

  const totalResponses = responses.length;

  const [candidateStatusCount, setCandidateStatusCount] = useState({
    [CandidateStatus.NO_STATUS]: 0,
    [CandidateStatus.NOT_SELECTED]: 0,
    [CandidateStatus.POTENTIAL]: 0,
    [CandidateStatus.SELECTED]: 0,
  });

  const [tableData, setTableData] = useState<TableData[]>([]);

  const prepareTableData = (responses: Response[]): TableData[] => {
    return responses.map((response) => ({
      call_id: response.call_id,
      name: response.name || "Anonymous",
      overallScore: response.analytics?.overallScore || 0,
      communicationScore: response.analytics?.communication?.score || 0,
      callSummary:
        response.analytics?.softSkillSummary ||
        response.details?.call_analysis?.call_summary ||
        "No summary available",
    }));
  };

  useEffect(() => {
    if (!interviewers || !interview) {
      return;
    }
    const interviewer = interviewers.find(
      (interviewer) => interviewer.id === interview.interviewer_id,
    );
    setInterviewer(interviewer);
  }, [interviewers, interview]);

  useEffect(() => {
    if (!responses) {
      return;
    }

    const sentimentCounter = {
      positive: 0,
      negative: 0,
      neutral: 0,
    };

    const callCompletionCounter = {
      complete: 0,
      incomplete: 0,
      partial: 0,
    };

    let totalDuration = 0;
    let completedCount = 0;

    const statusCounter = {
      [CandidateStatus.NO_STATUS]: 0,
      [CandidateStatus.NOT_SELECTED]: 0,
      [CandidateStatus.POTENTIAL]: 0,
      [CandidateStatus.SELECTED]: 0,
    };

    responses.forEach((response) => {
      const sentiment = response.details?.call_analysis?.user_sentiment;
      if (sentiment === "Positive") {
        sentimentCounter.positive += 1;
      } else if (sentiment === "Negative") {
        sentimentCounter.negative += 1;
      } else if (sentiment === "Neutral") {
        sentimentCounter.neutral += 1;
      }

      const callCompletion =
        response.details?.call_analysis?.call_completion_rating;
      if (callCompletion === "Complete") {
        callCompletionCounter.complete += 1;
      } else if (callCompletion === "Incomplete") {
        callCompletionCounter.incomplete += 1;
      } else if (callCompletion === "Partial") {
        callCompletionCounter.partial += 1;
      }

      const agentTaskCompletion =
        response.details?.call_analysis?.agent_task_completion_rating;
      if (
        agentTaskCompletion === "Complete" ||
        agentTaskCompletion === "Partial"
      ) {
        completedCount += 1;
      }

      totalDuration += response.duration;
      if (
        Object.values(CandidateStatus).includes(
          response.candidate_status as CandidateStatus,
        )
      ) {
        statusCounter[response.candidate_status as CandidateStatus]++;
      }
    });

    setSentimentCount(sentimentCounter);
    setCallCompletion(callCompletionCounter);
    setTotalDuration(totalDuration);
    setCompletedInterviews(completedCount);
    setCandidateStatusCount(statusCounter);

    const preparedData = prepareTableData(responses);
    setTableData(preparedData);
  }, [responses]);

  return (
    <div className="h-screen z-[10] mx-2">
      {responses.length > 0 ? (
        <div className="bg-slate-200 rounded-2xl min-h-[120px] p-2 ">
          <div className="flex flex-row gap-2 justify-between items-center mx-2">
            <div className="flex flex-row gap-2 items-center">
              <p className="font-semibold my-2">Overall Analysis</p>
            </div>
            <p className="text-sm">
              Interviewer used:{" "}
              <span className="font-medium">{interviewer?.name}</span>
            </p>
          </div>
          <p className="my-3 ml-2 text-sm">
            Interview Description:{" "}
            <span className="font-medium">{interview?.description}</span>
          </p>
          <div className="flex flex-col gap-1 my-2 mt-4 mx-2 p-4 rounded-2xl bg-slate-50 shadow-md">
            <ScrollArea className="h-[250px]">
              <DataTable data={tableData} interviewId={interview?.id || ""} />
            </ScrollArea>
          </div>
          <div className="flex flex-row gap-1 my-2 justify-center">
            <div className="flex flex-col">
              <div className="flex flex-col gap-1 my-2 mt-4 mx-2 p-3 rounded-2xl bg-slate-50 shadow-md max-w-[400px]">
                <div className="flex flex-row items-center justify-center gap-1 font-semibold mb-1 text-[15px]">
                  Average Duration
                  <InfoTooltip content="Average time users took to complete an interview" />
                </div>
                <div className="flex items-center justify-center">
                  <p className="text-2xl font-semibold text-brand-bold w-fit p-1 px-2 bg-brand-subtlest rounded-md">
                    {convertSecondstoMMSS(totalDuration / responses.length)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center gap-1 mx-2 p-3 rounded-2xl bg-slate-50 shadow-md max-w-[360px]">
                <div className="flex flex-row gap-1 font-semibold mb-1 text-[15px] mx-auto text-center">
                  Interview Completion Rate
                  <InfoTooltip content="Percentage of interviews completed successfully" />
                </div>
                <p className="w-fit text-2xl font-semibold text-brand-bold  p-1 px-2 bg-brand-subtlest rounded-md">
                  {Math.round(
                    (completedInterviews / responses.length) * 10000,
                  ) / 100}
                  %
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-1 my-2 mt-4 mx-2 p-4 rounded-2xl bg-slate-50 shadow-md max-w-[360px]">
              <div className="flex flex-row gap-2 text-[15px] font-bold mb-3 mx-auto">
                <SmileIcon />
                Candidate Sentiment
                <InfoTooltip content="Distribution of user sentiments during interviews" />
              </div>
              <DonutChart
                data={[
                  {
                    value: sentimentCount.positive,
                    label: `Positive (${sentimentCount.positive})`,
                    color: "#36B37E",
                  },
                  {
                    value: sentimentCount.neutral,
                    label: `Neutral (${sentimentCount.neutral})`,
                    color: "#FFAB00",
                  },
                  {
                    value: sentimentCount.negative,
                    label: `Negative (${sentimentCount.negative})`,
                    color: "#FF5630",
                  },
                ]}
                size={120}
              />
            </div>
            <div className="flex flex-col gap-1 my-2 mt-4 mx-2 p-4 rounded-2xl bg-slate-50 shadow-md">
              <div className="flex flex-row gap-2 text-[15px] font-bold mx-auto mb-1">
                <UserCircleIcon />
                Candidate Status
                <InfoTooltip content="Breakdown of the candidate selection status" />
              </div>
              <div className="text-sm text-center mb-1">
                Total Responses: {totalResponses}
              </div>
              <DonutChart
                data={[
                  {
                    value: candidateStatusCount[CandidateStatus.SELECTED],
                    label: `Selected (${candidateStatusCount[CandidateStatus.SELECTED]})`,
                    color: "#36B37E",
                  },
                  {
                    value: candidateStatusCount[CandidateStatus.POTENTIAL],
                    label: `Potential (${candidateStatusCount[CandidateStatus.POTENTIAL]})`,
                    color: "#FFAB00",
                  },
                  {
                    value:
                      candidateStatusCount[CandidateStatus.NOT_SELECTED],
                    label: `Not Selected (${candidateStatusCount[CandidateStatus.NOT_SELECTED]})`,
                    color: "#FF5630",
                  },
                  {
                    value: candidateStatusCount[CandidateStatus.NO_STATUS],
                    label: `No Status (${candidateStatusCount[CandidateStatus.NO_STATUS]})`,
                    color: "#9CA3AF",
                  },
                ]}
                size={120}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="w-[85%] h-[60%] flex flex-col items-center justify-center">
          <div className="flex flex-col items-center">
            <Image
              src="/no-responses.png"
              alt="logo"
              width={270}
              height={270}
            />
            <p className="text-center text-sm mt-0">
              Please share with your intended respondents
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default SummaryInfo;
