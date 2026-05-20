import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { useInterviewers } from "@/contexts/interviewers.context";
import { InterviewBase, Question, Seniority } from "@/types/interview";
import { ChevronRight, ChevronLeft, Info, X } from "lucide-react";
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
  // Dedicated PDF-upload state for the JD (separate from the generic-doc
  // FileUpload below — the existing one feeds question generation, this one
  // feeds the JD textarea).
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
      const truncated = parsed.slice(0, JD_MAX_LENGTH);
      setJobDescription(truncated);
      toast.warning(
        "Job description trimmed to 5000 characters. Please review and edit if needed.",
        { position: "bottom-right", duration: 4000 },
      );
    } else {
      setJobDescription(parsed);
    }
  };

  const slideLeft = (id: string, value: number) => {
    var slider = document.getElementById(`${id}`);
    if (slider) {
      slider.scrollLeft = slider.scrollLeft - value;
    }
  };

  const slideRight = (id: string, value: number) => {
    var slider = document.getElementById(`${id}`);
    if (slider) {
      slider.scrollLeft = slider.scrollLeft + value;
    }
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
      // v2 fields — reset so stale values don't persist across modal reopens.
      setJobDescription("");
      setSeniority("mid");
      setMustHaves([]);
      setMustHaveInput("");
      setJdIsUploaded(false);
      setJdFileName("");
    }
  }, [open]);

  return (
    <>
      <div className="text-center w-full">
        <h1 className="text-xl font-semibold">Create an Interview</h1>
        <div className="flex flex-col justify-center items-start mt-4 ml-10 mr-8">
          <div className="flex flex-row justify-center items-center">
            <h3 className="text-sm font-medium">Interview Name:</h3>
            <input
              type="text"
              className="border-b-2 focus:outline-none border-gray-500 px-2 w-96 py-0.5 ml-3"
              placeholder="e.g. Name of the Interview"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={(e) => setName(e.target.value.trim())}
            />
          </div>
          <h3 className="text-sm mt-3 font-medium">Select an Interviewer:</h3>
          <div className="relative flex items-center mt-1">
            <div
              id="slider-3"
              className=" h-36 pt-1 overflow-x-scroll scroll whitespace-nowrap scroll-smooth scrollbar-hide w-full"
            >
              {interviewers.map((item, key) => (
                <div
                  className=" p-0 inline-block cursor-pointer ml-1 mr-5 rounded-xl shrink-0 overflow-hidden"
                  key={item.id}
                >
                  <button
                    className="absolute ml-9"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInterviewerDetails(item);
                      setOpenInterviewerDetails(true);
                    }}
                  >
                    <Info size={18} color="#4f46e5" strokeWidth={2.2} />
                  </button>
                  <div
                    className={`w-[96px] overflow-hidden rounded-full ${
                      selectedInterviewer === item.id
                        ? "border-4 border-brand-bold"
                        : ""
                    }`}
                    onClick={() => setSelectedInterviewer(item.id)}
                  >
                    <Image
                      src={item.image}
                      alt="Picture of the interviewer"
                      width={70}
                      height={70}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardTitle className="mt-0 text-xs text-center">
                    {item.name}
                  </CardTitle>
                </div>
              ))}
            </div>
            {interviewers.length > 4 ? (
              <div className="flex-row justify-center ml-3 mb-1 items-center space-y-6">
                <ChevronRight
                  className="opacity-50 cursor-pointer hover:opacity-100"
                  size={27}
                  onClick={() => slideRight("slider-3", 115)}
                />
                <ChevronLeft
                  className="opacity-50 cursor-pointer hover:opacity-100"
                  size={27}
                  onClick={() => slideLeft("slider-3", 115)}
                />
              </div>
            ) : (
              <></>
            )}
          </div>
          <h3 className="text-sm font-medium">Objective:</h3>
          <Textarea
            value={objective}
            className="h-24 mt-2 border-2 border-gray-500 w-full"
            placeholder="e.g. Find best candidates based on their technical skills and previous projects."
            onChange={(e) => setObjective(e.target.value)}
            onBlur={(e) => setObjective(e.target.value.trim())}
          />
          <h3 className="text-sm font-medium mt-2">
            Upload any documents related to the interview.
          </h3>
          <FileUpload
            isUploaded={isUploaded}
            setIsUploaded={setIsUploaded}
            fileName={fileName}
            setFileName={setFileName}
            setUploadedDocumentContext={setUploadedDocumentContext}
          />

          {/* ============================================================ */}
          {/* Hiring criteria — v2 hiring-grade analytics fields           */}
          {/* (openspec analytics-v2-followups)                            */}
          {/* ============================================================ */}
          <hr className="my-4 border-t border-dashed border-stone-200 w-full" />
          <p className="text-sm font-medium">Hiring criteria</p>
          <p className="text-xs italic text-stone-500 mt-1 mb-2">
            Used by the hiring-grade scoring rubric. All optional — strong
            defaults apply.
          </p>

          {/* JD PDF upload */}
          <h3 className="text-sm font-medium mt-2">
            Upload Job Description (PDF) — optional
          </h3>
          <FileUpload
            isUploaded={jdIsUploaded}
            setIsUploaded={setJdIsUploaded}
            fileName={jdFileName}
            setFileName={setJdFileName}
            setUploadedDocumentContext={setJobDescriptionFromUpload}
          />

          {/* JD textarea (source of truth) */}
          <label
            htmlFor="job-description"
            className="text-sm font-medium mt-3 block"
          >
            Job Description — optional
          </label>
          <Textarea
            id="job-description"
            value={jobDescription}
            maxLength={JD_MAX_LENGTH}
            className="h-24 mt-2 border-2 border-gray-500 w-full"
            placeholder="Paste or upload a job description. You can edit after upload."
            onChange={(e) => setJobDescription(e.target.value)}
          />
          {jobDescription.length > JD_COUNTER_VISIBLE_AT ? (
            <p className="text-xs italic text-stone-500 mt-1 text-right">
              {JD_MAX_LENGTH - jobDescription.length} characters remaining
            </p>
          ) : null}

          {/* Seniority Select (flat-underline trigger per design OD-1) */}
          <label
            htmlFor="seniority-select"
            className="text-sm font-medium mt-3 block"
          >
            Seniority level
          </label>
          <Select
            value={seniority}
            onValueChange={(v) => setSeniority(v as Seniority)}
          >
            <SelectTrigger
              id="seniority-select"
              className="border-0 border-b-2 border-gray-500 rounded-none bg-transparent h-9 px-0 mt-1 focus:ring-0 focus:ring-offset-0 text-sm"
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

          {/* Must-haves chip list */}
          <label
            htmlFor="must-have-input"
            className="text-sm font-medium mt-3 block"
          >
            Must-haves — optional, up to {MUST_HAVES_CAP}
          </label>
          <div className="flex flex-row gap-2 mt-1 w-full">
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
              className="border-b-2 focus:outline-none border-gray-500 px-2 py-0.5 flex-1 min-w-0 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="flex flex-wrap gap-1 mt-2">
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
          <hr className="my-4 border-t border-dashed border-stone-200 w-full" />
          {/* End: Hiring criteria */}
          <label className="flex-col mt-7 w-full">
            <div className="flex items-center cursor-pointer">
              <span className="text-sm font-medium">
                Do you prefer the interviewees&apos; responses to be anonymous?
              </span>
              <Switch
                checked={isAnonymous}
                className={`ml-4 mt-1 ${
                  isAnonymous ? "bg-brand-bold" : "bg-[#E6E7EB]"
                }`}
                onCheckedChange={(checked) => setIsAnonymous(checked)}
              />
            </div>
            <span
              style={{ fontSize: "0.7rem", lineHeight: "0.66rem" }}
              className="font-light text-xs italic w-full text-left block"
            >
              Note: If not anonymous, the interviewee&apos;s email and name will
              be collected.
            </span>
          </label>
          <div className="flex flex-row gap-3 justify-between w-full mt-3">
            <div className="flex flex-row justify-center items-center ">
              <h3 className="text-sm font-medium ">Number of Questions:</h3>
              <input
                type="number"
                step="1"
                max="5"
                min="1"
                className="border-b-2 text-center focus:outline-none  border-gray-500 w-14 px-2 py-0.5 ml-3"
                value={numQuestions}
                onChange={(e) => {
                  let value = e.target.value;
                  if (
                    value === "" ||
                    (Number.isInteger(Number(value)) && Number(value) > 0)
                  ) {
                    if (Number(value) > 5) {
                      value = "5";
                    }
                    setNumQuestions(value);
                  }
                }}
              />
            </div>
            <div className="flex flex-row justify-center items-center">
              <h3 className="text-sm font-medium ">Duration (mins):</h3>
              <input
                type="number"
                step="1"
                min="1"
                className="border-b-2 text-center focus:outline-none  border-gray-500 w-14 px-2 py-0.5 ml-3"
                value={duration}
                onChange={(e) => {
                  let value = e.target.value;
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
          <div className="flex flex-row w-full justify-center items-center space-x-24 mt-5">
            <Button
              disabled={
                (name &&
                objective &&
                numQuestions &&
                duration &&
                selectedInterviewer != BigInt(0)
                  ? false
                  : true) || isClicked
              }
              className="bg-brand-bold hover:bg-brand-bolder  w-40"
              onClick={() => {
                setIsClicked(true);
                onGenrateQuestions();
              }}
            >
              Generate Questions
            </Button>
            <Button
              disabled={
                (name &&
                objective &&
                numQuestions &&
                duration &&
                selectedInterviewer != BigInt(0)
                  ? false
                  : true) || isClicked
              }
              className="bg-brand-bold w-40 hover:bg-brand-bolder"
              onClick={() => {
                setIsClicked(true);
                onManual();
              }}
            >
              I&apos;ll do it myself
            </Button>
          </div>
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
