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
  // openspec add-interview-proctoring-camera-screen — both default false;
  // recruiter opts in per-interview via DetailsPopup toggles.
  proctoring_camera_enabled: false,
  proctoring_screen_enabled: false,
});

function CreateInterviewModal({ open, setOpen }: Props) {
  const [loading, setLoading] = useState(false);
  const [proceed, setProceed] = useState(false);
  const [interviewData, setInterviewData] = useState<InterviewBase>(CreateEmptyInterviewData());

  // Below for File Upload
  const [isUploaded, setIsUploaded] = useState(false);
  const [fileName, setFileName] = useState("");

  // Transition Details → Questions popup ONLY when interviewData is updated
  // by a successful generate/manual handler. Including `loading` in the deps
  // (the previous behavior) caused the effect to fire the moment
  // setLoading(true) ran — instantly flipping proceed:true before the API
  // call returned, so the operator saw an empty QuestionsPopup for the
  // duration of the request instead of the LoaderWithLogo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `loading` is intentionally read but not in deps — see comment above
  useEffect(() => {
    if (loading === true) {
      setLoading(false);
      setProceed(true);
    }
  }, [interviewData]);

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

  // ---- Render strategy ----
  // DetailsPopup MUST stay mounted across all transitions (loading and
  // proceed=true) so that the operator's in-progress form state — step
  // position, name, objective, JD, must-haves, num-questions, etc. — is
  // preserved when:
  //   1. The loader is shown during the API call (then the form returns to
  //      view if validation/preflight diverts back to the form)
  //   2. The operator clicks the back chevron in QuestionsPopup (which
  //      flips `proceed` back to false — without this strategy, DetailsPopup
  //      would remount fresh and the operator would lose everything)
  //
  // We hide it with `display:none` rather than unmounting it. LoaderWithLogo
  // and QuestionsPopup still mount/unmount on demand — they have no
  // operator-input state that needs preserving across those transitions
  // (QuestionsPopup initializes its local `questions` from interviewData
  // at mount time, so a fresh mount after `proceed: true` picks up the
  // newly-generated questions correctly).
  return (
    <>
      <div
        style={{ display: !loading && !proceed ? "block" : "none" }}
        aria-hidden={loading || proceed}
      >
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
      </div>
      {loading ? (
        <div className="flex h-[min(35rem,80vh)] w-full items-center justify-center">
          <LoaderWithLogo />
        </div>
      ) : null}
      {proceed ? (
        <QuestionsPopup
          interviewData={interviewData}
          setProceed={setProceed}
          setOpen={setOpen}
        />
      ) : null}
    </>
  );
}

export default CreateInterviewModal;
