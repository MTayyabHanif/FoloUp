import { useEffect, useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Copy, ArrowUpRight } from "lucide-react";
import { CopyCheck } from "lucide-react";
import { ResponseService } from "@/services/responses.service";
import axios from "axios";
import MiniLoader from "@/components/loaders/mini-loader/miniLoader";
import { InterviewerService } from "@/services/interviewers.service";

interface Props {
  name: string | null;
  interviewerId: bigint;
  id: string;
  url: string;
  readableSlug: string;
}

const base_url = process.env.NEXT_PUBLIC_LIVE_URL;

function InterviewCard({ name, interviewerId, id, url, readableSlug }: Props) {
  const [copied, setCopied] = useState(false);
  const [responseCount, setResponseCount] = useState<number | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [img, setImg] = useState("");

  useEffect(() => {
    const fetchInterviewer = async () => {
      const interviewer =
        await InterviewerService.getInterviewer(interviewerId);
      setImg(interviewer.image);
    };
    fetchInterviewer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchResponses = async () => {
      try {
        const responses = await ResponseService.getAllResponses(id);
        setResponseCount(responses.length);
        if (responses.length > 0) {
          setIsFetching(true);
          for (const response of responses) {
            if (!response.is_analysed) {
              try {
                const result = await axios.post("/api/get-call", {
                  id: response.call_id,
                });

                if (result.status !== 200) {
                  throw new Error(`HTTP error! status: ${result.status}`);
                }
              } catch (error) {
                console.error(
                  `Failed to call api/get-call for response id ${response.call_id}:`,
                  error,
                );
              }
            }
          }
          setIsFetching(false);
        }
      } catch (error) {
        console.error(error);
      }
    };

    fetchResponses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(
        readableSlug ? `${base_url}/call/${readableSlug}` : (url as string),
      )
      .then(
        () => {
          setCopied(true);
          toast.success(
            "The link to your interview has been copied to your clipboard.",
            {
              position: "bottom-right",
              duration: 3000,
            },
          );
          setTimeout(() => {
            setCopied(false);
          }, 2000);
        },
        (err) => {
          console.log("failed to copy", err.mesage);
        },
      );
  };

  const handleJumpToInterview = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const interviewUrl = readableSlug
      ? `/call/${readableSlug}`
      : `/call/${url}`;
    window.open(interviewUrl, "_blank");
  };

  return (
    <a
      href={`/interviews/${id}`}
      style={{
        pointerEvents: isFetching ? "none" : "auto",
        cursor: isFetching ? "default" : "pointer",
      }}
    >
      <Card className="group relative flex h-60 cursor-pointer flex-col overflow-hidden rounded-xl p-0 transition-all hover:-translate-y-0.5 hover:shadow-[var(--ds-shadow-overflow)]">
        <CardContent className={`flex h-full flex-col p-0 ${isFetching ? "opacity-60" : ""}`}>
          {/* Header band — brand-bold tint with truncating title */}
          <div className="flex h-32 w-full items-center justify-center bg-brand-bold px-4 py-3 text-center">
            <CardTitle className="line-clamp-3 w-full text-base font-semibold text-white">
              {name}
              {isFetching && (
                <div className="mt-1">
                  <MiniLoader />
                </div>
              )}
            </CardTitle>
          </div>
          {/* Footer row — interviewer avatar + response count */}
          <div className="flex flex-1 items-center justify-between gap-3 px-4 py-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
              <Image
                src={img}
                alt="Interviewer"
                width={48}
                height={48}
                className="h-full w-full object-cover object-center"
              />
            </div>
            <div className="min-w-0 flex-1 text-right text-sm">
              <p className="truncate font-semibold text-foreground">
                {responseCount?.toString() || 0}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {responseCount === 1 ? "response" : "responses"}
              </p>
            </div>
          </div>
          {/* Floating actions in top-right */}
          <div className="absolute right-2 top-2 flex gap-1">
            <Button
              className="h-7 w-7 bg-white/90 p-0 text-brand-bold shadow-sm hover:bg-white"
              variant={"secondary"}
              onClick={handleJumpToInterview}
              aria-label="Open interview"
            >
              <ArrowUpRight size={14} />
            </Button>
            <Button
              className={`h-7 w-7 p-0 shadow-sm ${
                copied
                  ? "bg-brand-subtle text-white hover:bg-brand-subtle"
                  : "bg-white/90 text-brand-bold hover:bg-white"
              }`}
              variant={"secondary"}
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                copyToClipboard();
              }}
              aria-label={copied ? "Link copied" : "Copy interview link"}
            >
              {copied ? <CopyCheck size={14} /> : <Copy size={14} />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

export default InterviewCard;
