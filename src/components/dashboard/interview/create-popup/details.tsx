import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { useInterviewers } from "@/contexts/interviewers.context";
import { InterviewBase, Question, Seniority } from "@/types/interview";
import {
  ChevronRight,
  ChevronLeft,
  Info,
  X,
  Check,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import Image from "next/image";
import { CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FileUpload from "../fileUpload";
import Modal from "@/components/dashboard/Modal";
import InterviewerDetailsModal from "@/components/dashboard/interviewer/interviewerDetailsModal";
import { Interviewer } from "@/types/interviewer";

const JD_MAX_LENGTH = 5000;
const JD_COUNTER_VISIBLE_AT = 3500;
const MUST_HAVES_CAP = 10;

const STEPS = [
  { id: 0, label: "Basics", help: "Name, interviewer, objective" },
  { id: 1, label: "Hiring criteria", help: "JD, seniority, must-haves" },
  { id: 2, label: "Questions", help: "Count, duration, generate" },
] as const;

interface Props {
  open: boolean;
  setLoading: (loading: boolean) => void;
  interviewData: InterviewBase;
  setInterviewData: (interviewData: InterviewBase) => void;
  isUploaded: boolean;
  setIsUploaded: (isUploaded: boolean) => void;
  fileName: string;
  setFileName: (fileName: string) => void;
}

// ============================================================================
// Stepper header — visible across all steps
// ============================================================================

function StepperHeader({
  current,
  reachable,
  onJump,
}: {
  current: number;
  reachable: number;
  onJump: (step: number) => void;
}) {
  return (
    <ol className="flex items-stretch justify-between gap-0 mt-4 w-full">
      {STEPS.map((step, i) => {
        const isDone = i < current;
        const isCurrent = i === current;
        const canJump = i <= reachable;
        return (
          <React.Fragment key={step.id}>
            <li className="flex flex-col items-center flex-1 min-w-0">
              <button
                type="button"
                disabled={!canJump}
                onClick={() => canJump && onJump(i)}
                className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-semibold transition-colors ${
                  isCurrent
                    ? "bg-brand-bold text-white shadow"
                    : isDone
                      ? "bg-brand-bold/80 text-white"
                      : "bg-stone-200 text-stone-500"
                } ${canJump ? "cursor-pointer hover:opacity-90" : "cursor-not-allowed"}`}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${step.label}`}
              >
                {isDone ? <Check className="h-4 w-4" /> : i + 1}
              </button>
              <div className="mt-1.5 text-center">
                <p
                  className={`text-xs font-medium leading-none ${
                    isCurrent ? "text-[#0a1d08]" : "text-stone-500"
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-[10px] italic text-stone-400 mt-0.5 hidden sm:block">
                  {step.help}
                </p>
              </div>
            </li>
            {i < STEPS.length - 1 ? (
              <li
                className={`flex-1 h-0.5 mt-4 mx-1 ${
                  i < current ? "bg-brand-bold/60" : "bg-stone-200"
                }`}
                aria-hidden
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

// ============================================================================
// Main popup
// ============================================================================

function DetailsPopup({
  open,
  setLoading,
  interviewData,
  setInterviewData,
  isUploaded,
  setIsUploaded,
  fileName,
  setFileName,
}: Props) {
  const { interviewers } = useInterviewers();
  const [isClicked, setIsClicked] = useState(false);
  const [openInterviewerDetails, setOpenInterviewerDetails] = useState(false);
  const [interviewerDetails, setInterviewerDetails] = useState<Interviewer>();

  // Stepper position. `reachable` tracks the furthest step the operator has
  // unlocked — going Back doesn't lock the user out of forward jumps.
  const [step, setStep] = useState(0);
  const [reachable, setReachable] = useState(0);

  const [name, setName] = useState(interviewData.name);
  const [selectedInterviewer, setSelectedInterviewer] = useState(
    interviewData.interviewer_id,
  );
  const [objective, setObjective] = useState(interviewData.objective);
  const [isAnonymous, setIsAnonymous] = useState<boolean>(
    interviewData.is_anonymous,
  );
  const [numQuestions, setNumQuestions] = useState(
    interviewData.question_count == 0
      ? ""
      : String(interviewData.question_count),
  );
  const [duration, setDuration] = useState(interviewData.time_duration);
  const [uploadedDocumentContext, setUploadedDocumentContext] = useState("");

  // v2 hiring-grade scoring fields (openspec analytics-v2-followups).
  // jobDescription is the source of truth — the PDF upload below is a
  // convenience that fills this textarea; operator can paste/edit directly.
  const [jobDescription, setJobDescription] = useState<string>(
    interviewData.job_description ?? "",
  );
  const [seniority, setSeniority] = useState<Seniority>(
    (interviewData.seniority as Seniority) ?? "mid",
  );
  const [mustHaves, setMustHaves] = useState<string[]>(
    interviewData.must_haves ?? [],
  );
  const [mustHaveInput, setMustHaveInput] = useState<string>("");
  const [jdIsUploaded, setJdIsUploaded] = useState<boolean>(false);
  const [jdFileName, setJdFileName] = useState<string>("");

  const atMustHaveCap = mustHaves.length >= MUST_HAVES_CAP;

  const handleAddMustHave = () => {
    const trimmed = mustHaveInput.trim();
    if (!trimmed || atMustHaveCap) {return;}
    setMustHaves([...mustHaves, trimmed]);
    setMustHaveInput("");
  };

  const removeMustHave = (item: string) => {
    setMustHaves(mustHaves.filter((m) => m !== item));
  };

  const setJobDescriptionFromUpload = (parsed: string) => {
    if (parsed.length > JD_MAX_LENGTH) {
      setJobDescription(parsed.slice(0, JD_MAX_LENGTH));
      toast.warning(
        "Job description trimmed to 5000 characters. Please review and edit if needed.",
        { position: "bottom-right", duration: 4000 },
      );
    } else {
      setJobDescription(parsed);
    }
  };

  const slideLeft = (id: string, value: number) => {
    const slider = document.getElementById(id);
    if (slider) {
      slider.scrollLeft = slider.scrollLeft - value;
    }
  };

  const slideRight = (id: string, value: number) => {
    const slider = document.getElementById(id);
    if (slider) {
      slider.scrollLeft = slider.scrollLeft + value;
    }
  };

  // ---- step validation ----
  const step0Valid =
    !!name.trim() &&
    !!objective.trim() &&
    selectedInterviewer !== BigInt(0);
  const step2Valid = !!numQuestions && !!duration;
  const canSubmit = step0Valid && step2Valid && !isClicked;

  const advance = () => {
    if (step < STEPS.length - 1) {
      const next = step + 1;
      setStep(next);
      setReachable(Math.max(reachable, next));
    }
  };
  const goBack = () => {
    if (step > 0) {setStep(step - 1);}
  };

  const onGenrateQuestions = async () => {
    setLoading(true);

    const data = {
      name: name.trim(),
      objective: objective.trim(),
      number: numQuestions,
      context: uploadedDocumentContext,
    };

    const generatedQuestions = (await axios.post(
      "/api/generate-interview-questions",
      data,
    )) as any;

    const generatedQuestionsResponse = JSON.parse(
      generatedQuestions?.data?.response,
    );

    const updatedQuestions = generatedQuestionsResponse.questions.map(
      (question: Question) => ({
        id: uuidv4(),
        question: question.question.trim(),
        follow_up_count: 1,
      }),
    );

    const updatedInterviewData = {
      ...interviewData,
      name: name.trim(),
      objective: objective.trim(),
      questions: updatedQuestions,
      interviewer_id: selectedInterviewer,
      question_count: Number(numQuestions),
      time_duration: duration,
      description: generatedQuestionsResponse.description,
      is_anonymous: isAnonymous,
      // v2 hiring-grade scoring fields
      job_description: jobDescription.trim(),
      seniority,
      must_haves: mustHaves.map((s) => s.trim()).filter(Boolean),
    };
    setInterviewData(updatedInterviewData);
  };

  const onManual = () => {
    setLoading(true);

    const updatedInterviewData = {
      ...interviewData,
      name: name.trim(),
      objective: objective.trim(),
      questions: [{ id: uuidv4(), question: "", follow_up_count: 1 }],
      interviewer_id: selectedInterviewer,
      question_count: Number(numQuestions),
      time_duration: String(duration),
      description: "",
      is_anonymous: isAnonymous,
      // v2 hiring-grade scoring fields
      job_description: jobDescription.trim(),
      seniority,
      must_haves: mustHaves.map((s) => s.trim()).filter(Boolean),
    };
    setInterviewData(updatedInterviewData);
  };

  useEffect(() => {
    if (!open) {
      setName("");
      setSelectedInterviewer(BigInt(0));
      setObjective("");
      setIsAnonymous(false);
      setNumQuestions("");
      setDuration("");
      setIsClicked(false);
      // v2 fields
      setJobDescription("");
      setSeniority("mid");
      setMustHaves([]);
      setMustHaveInput("");
      setJdIsUploaded(false);
      setJdFileName("");
      // Stepper
      setStep(0);
      setReachable(0);
    }
  }, [open]);

  return (
    <>
      <div className="w-full">
        {/* ===== Header ===== */}
        <div className="text-center">
          <h1 className="text-xl font-semibold text-[#0a1d08]">
            Create an Interview
          </h1>
          <StepperHeader
            current={step}
            reachable={reachable}
            onJump={(i) => {
              if (i <= reachable) {setStep(i);}
            }}
          />
        </div>

        {/* ===== Step body ===== */}
        <div className="mt-6 px-2 min-h-[24rem]">
          {step === 0 ? (
            <div className="flex flex-col gap-4">
              {/* Interview Name */}
              <div>
                <label
                  htmlFor="interview-name"
                  className="text-sm font-medium text-[#0a1d08]"
                >
                  Interview name
                </label>
                <input
                  id="interview-name"
                  type="text"
                  className="border-b-2 focus:outline-none border-gray-500 px-2 py-1 w-full mt-1"
                  placeholder="e.g. Senior Backend Engineer — screening"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={(e) => setName(e.target.value.trim())}
                />
              </div>

              {/* Interviewer carousel */}
              <div>
                <label className="text-sm font-medium text-[#0a1d08]">
                  Select an interviewer
                </label>
                <div className="relative flex items-center mt-1">
                  <div
                    id="slider-3"
                    className="h-28 pt-1 overflow-x-scroll whitespace-nowrap scroll-smooth scrollbar-hide w-full"
                  >
                    {interviewers.map((item) => (
                      <div
                        key={item.id}
                        className="p-0 inline-block cursor-pointer ml-1 mr-4 rounded-xl shrink-0 overflow-hidden align-top"
                      >
                        <button
                          className="absolute ml-9"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInterviewerDetails(item);
                            setOpenInterviewerDetails(true);
                          }}
                          aria-label={`View ${item.name} details`}
                        >
                          <Info size={16} color="#4f46e5" strokeWidth={2.2} />
                        </button>
                        <div
                          className={`w-[76px] h-[76px] overflow-hidden rounded-full ${
                            selectedInterviewer === item.id
                              ? "border-4 border-brand-bold"
                              : "border border-stone-200"
                          }`}
                          onClick={() => setSelectedInterviewer(item.id)}
                        >
                          <Image
                            src={item.image}
                            alt={`Picture of ${item.name}`}
                            width={70}
                            height={70}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <CardTitle className="mt-1 text-[11px] text-center font-medium">
                          {item.name}
                        </CardTitle>
                      </div>
                    ))}
                  </div>
                  {interviewers.length > 4 ? (
                    <div className="flex flex-col justify-center ml-2 items-center gap-1">
                      <ChevronRight
                        className="opacity-50 cursor-pointer hover:opacity-100"
                        size={20}
                        onClick={() => slideRight("slider-3", 115)}
                      />
                      <ChevronLeft
                        className="opacity-50 cursor-pointer hover:opacity-100"
                        size={20}
                        onClick={() => slideLeft("slider-3", 115)}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Objective */}
              <div>
                <label
                  htmlFor="objective"
                  className="text-sm font-medium text-[#0a1d08]"
                >
                  Objective
                </label>
                <Textarea
                  id="objective"
                  value={objective}
                  className="h-20 mt-1 border-2 border-gray-500 w-full"
                  placeholder="e.g. Find best candidates based on technical skills and previous projects."
                  onChange={(e) => setObjective(e.target.value)}
                  onBlur={(e) => setObjective(e.target.value.trim())}
                />
              </div>

              {/* Anonymous toggle — compact inline row */}
              <div className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#0a1d08]">
                    Anonymous responses
                  </p>
                  <p className="text-[11px] italic text-stone-500 mt-0.5">
                    If off, the interviewee&apos;s email and name will be
                    collected.
                  </p>
                </div>
                <Switch
                  checked={isAnonymous}
                  className={
                    isAnonymous ? "bg-brand-bold" : "bg-[#E6E7EB]"
                  }
                  onCheckedChange={(checked) => setIsAnonymous(checked)}
                />
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <p className="text-xs italic text-stone-500">
                These fields power the hiring-grade scoring rubric. All
                optional — strong defaults apply.
              </p>

              {/* Two-column row on desktop: JD upload | Seniority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#0a1d08]">
                    Upload JD (PDF)
                  </label>
                  <p className="text-[11px] italic text-stone-500 mb-1">
                    Fills the textarea below — you can still edit.
                  </p>
                  <FileUpload
                    isUploaded={jdIsUploaded}
                    setIsUploaded={setJdIsUploaded}
                    fileName={jdFileName}
                    setFileName={setJdFileName}
                    setUploadedDocumentContext={setJobDescriptionFromUpload}
                  />
                </div>

                <div>
                  <label
                    htmlFor="seniority-select"
                    className="text-sm font-medium text-[#0a1d08]"
                  >
                    Seniority level
                  </label>
                  <p className="text-[11px] italic text-stone-500 mb-1">
                    Drives how strictly we score depth-of-knowledge.
                  </p>
                  <Select
                    value={seniority}
                    onValueChange={(v) => setSeniority(v as Seniority)}
                  >
                    <SelectTrigger
                      id="seniority-select"
                      className="border-0 border-b-2 border-gray-500 rounded-none bg-transparent h-9 px-0 focus:ring-0 focus:ring-offset-0 text-sm"
                    >
                      <SelectValue placeholder="Select seniority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="junior">Junior</SelectItem>
                      <SelectItem value="mid">Mid</SelectItem>
                      <SelectItem value="senior">Senior</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="principal">Principal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* JD textarea — source of truth */}
              <div>
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor="job-description"
                    className="text-sm font-medium text-[#0a1d08]"
                  >
                    Job Description
                  </label>
                  {jobDescription.length > JD_COUNTER_VISIBLE_AT ? (
                    <span className="text-[11px] italic text-stone-500">
                      {JD_MAX_LENGTH - jobDescription.length} chars left
                    </span>
                  ) : null}
                </div>
                <Textarea
                  id="job-description"
                  value={jobDescription}
                  maxLength={JD_MAX_LENGTH}
                  className="h-24 mt-1 border-2 border-gray-500 w-full"
                  placeholder="Paste, upload, or type the JD. You can edit after uploading."
                  onChange={(e) => setJobDescription(e.target.value)}
                />
              </div>

              {/* Must-haves */}
              <div>
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor="must-have-input"
                    className="text-sm font-medium text-[#0a1d08]"
                  >
                    Must-haves
                  </label>
                  <span className="text-[11px] italic text-stone-500">
                    {mustHaves.length}/{MUST_HAVES_CAP}
                  </span>
                </div>
                <div className="flex flex-row gap-2 mt-1">
                  <input
                    id="must-have-input"
                    type="text"
                    value={mustHaveInput}
                    disabled={atMustHaveCap}
                    placeholder={
                      atMustHaveCap
                        ? `Limit of ${MUST_HAVES_CAP} reached`
                        : "e.g. 5+ years TypeScript"
                    }
                    className="border-b-2 focus:outline-none border-gray-500 px-2 py-1 flex-1 min-w-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    onChange={(e) => setMustHaveInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddMustHave();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    disabled={atMustHaveCap || !mustHaveInput.trim()}
                    onClick={handleAddMustHave}
                    className="bg-brand-bold hover:bg-brand-bolder h-8 px-3 text-xs"
                  >
                    Add
                  </Button>
                </div>
                {mustHaves.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {mustHaves.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1 rounded-full bg-stone-100 border border-stone-300 text-xs px-2 py-0.5"
                      >
                        {item}
                        <button
                          type="button"
                          aria-label={`Remove ${item}`}
                          onClick={() => removeMustHave(item)}
                          className="text-stone-500 hover:text-stone-900"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-4">
              {/* Question count + duration — inline row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="num-questions"
                    className="text-sm font-medium text-[#0a1d08]"
                  >
                    Number of questions
                  </label>
                  <p className="text-[11px] italic text-stone-500 mb-1">
                    Max 5 — keep the screen tight.
                  </p>
                  <input
                    id="num-questions"
                    type="number"
                    step="1"
                    max="5"
                    min="1"
                    className="border-b-2 focus:outline-none border-gray-500 w-20 px-2 py-1 text-center"
                    value={numQuestions}
                    onChange={(e) => {
                      let value = e.target.value;
                      if (
                        value === "" ||
                        (Number.isInteger(Number(value)) && Number(value) > 0)
                      ) {
                        if (Number(value) > 5) {value = "5";}
                        setNumQuestions(value);
                      }
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="duration"
                    className="text-sm font-medium text-[#0a1d08]"
                  >
                    Duration (mins)
                  </label>
                  <p className="text-[11px] italic text-stone-500 mb-1">
                    Used to detect abandoned calls.
                  </p>
                  <input
                    id="duration"
                    type="number"
                    step="1"
                    min="1"
                    className="border-b-2 focus:outline-none border-gray-500 w-20 px-2 py-1 text-center"
                    value={duration}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (
                        value === "" ||
                        (Number.isInteger(Number(value)) && Number(value) > 0)
                      ) {
                        setDuration(value);
                      }
                    }}
                  />
                </div>
              </div>

              {/* Optional supporting docs (kept here — feeds question generation) */}
              <details className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 group">
                <summary className="cursor-pointer text-sm font-medium text-[#0a1d08] list-none flex items-center justify-between">
                  <span>Supporting documents (optional)</span>
                  <span className="text-[11px] italic text-stone-500 group-open:hidden">
                    Click to expand
                  </span>
                </summary>
                <p className="text-[11px] italic text-stone-500 mt-2 mb-1">
                  Anything else that helps shape the generated questions —
                  not used in scoring.
                </p>
                <FileUpload
                  isUploaded={isUploaded}
                  setIsUploaded={setIsUploaded}
                  fileName={fileName}
                  setFileName={setFileName}
                  setUploadedDocumentContext={setUploadedDocumentContext}
                />
              </details>

              {/* Submit CTAs */}
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  disabled={!canSubmit}
                  variant="secondary"
                  className="h-10"
                  onClick={() => {
                    setIsClicked(true);
                    onManual();
                  }}
                >
                  I&apos;ll do it myself
                </Button>
                <Button
                  disabled={!canSubmit}
                  className="bg-brand-bold hover:bg-brand-bolder h-10"
                  onClick={() => {
                    setIsClicked(true);
                    onGenrateQuestions();
                  }}
                >
                  Generate questions →
                </Button>
              </div>
              {!step0Valid ? (
                <p className="text-[11px] italic text-stone-500 text-center">
                  Complete the Basics step first to enable submission.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ===== Bottom nav (always visible — Back/Next; final step's submit is inline above) ===== */}
        <div className="mt-6 flex items-center justify-between border-t border-stone-200 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={step === 0}
            className="text-stone-600 hover:text-[#0a1d08] disabled:opacity-30"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={advance}
              disabled={step === 0 && !step0Valid}
              className="bg-brand-bold hover:bg-brand-bolder text-white"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <span className="text-[11px] italic text-stone-400">
              Use the buttons above to generate or build manually.
            </span>
          )}
        </div>
      </div>

      <Modal
        open={openInterviewerDetails}
        size="xl"
        closeOnOutsideClick={true}
        onClose={() => {
          setOpenInterviewerDetails(false);
        }}
      >
        <InterviewerDetailsModal interviewer={interviewerDetails} />
      </Modal>
    </>
  );
}

export default DetailsPopup;
