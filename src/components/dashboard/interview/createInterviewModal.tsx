import DetailsPopup from "@/components/dashboard/interview/create-popup/details";
import QuestionsPopup from "@/components/dashboard/interview/create-popup/questions";
import LoaderWithLogo from "@/components/loaders/loader-with-logo/loaderWithLogo";
import type { InterviewBase } from "@/types/interview";
import React, { useEffect, useState } from "react";

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CreateEmptyInterviewData = (): InterviewBase => ({
  user_id: "",
  organization_id: "",
  name: "",
  interviewer_id: BigInt(0),
  objective: "",
  question_count: 4,
  time_duration: "",
  is_anonymous: false,
  invite_only: false,
  questions: [],
  description: "",
  response_count: BigInt(0),
  // v2 analytics scoring fields (openspec hiring-grade-analytics-scoring).
  // Empty defaults match the DB column defaults; a follow-up change adds
  // editor UI for these on the interview create form.
  job_description: "",
  seniority: "mid",
  must_haves: [],
  // v3 rubric-aware (openspec rubric-aware-interviewer-and-questions §6)
  // Populated when operator clicks "Save anyway" on the preflight modal.
  coverage_warnings: [],
});

function CreateInterviewModal({ open, setOpen }: Props) {
  const [loading, setLoading] = useState(false);
  const [proceed, setProceed] = useState(false);
  const [interviewData, setInterviewData] = useState<InterviewBase>(CreateEmptyInterviewData());

  // Below for File Upload
  const [isUploaded, setIsUploaded] = useState(false);
  const [fileName, setFileName] = useState("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: Need to check
  useEffect(() => {
    if (loading === true) {
      setLoading(false);
      setProceed(true);
    }
  }, [interviewData, loading]);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setProceed(false);
      setInterviewData(CreateEmptyInterviewData());
      // Below for File Upload
      setIsUploaded(false);
      setFileName("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      {loading ? (
        <div className="flex h-[min(35rem,80vh)] w-full items-center justify-center">
          <LoaderWithLogo />
        </div>
      ) : !proceed ? (
        <DetailsPopup
          open={open}
          setLoading={setLoading}
          interviewData={interviewData}
          setInterviewData={setInterviewData}
          // Below for File Upload
          isUploaded={isUploaded}
          setIsUploaded={setIsUploaded}
          fileName={fileName}
          setFileName={setFileName}
        />
      ) : (
        <QuestionsPopup interviewData={interviewData} setProceed={setProceed} setOpen={setOpen} />
      )}
    </>
  );
}

export default CreateInterviewModal;
