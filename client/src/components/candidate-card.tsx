import { Card } from "@/components/ui/card";
import { Mail, Phone, FileText } from "lucide-react";
import type { Candidate } from "@shared/schema";

interface CandidateCardProps {
  candidate: Candidate;
}

const stageColors = {
  "Submitted": "bg-white",
  "First Round": "bg-green-50",
  "Second Round": "bg-green-100",
  "Third Round": "bg-green-200",
  "Selected": "bg-green-300",
  "Rejected": "bg-red-50",
} as const;

export default function CandidateCard({ candidate }: CandidateCardProps) {
  return (
    <Card className={`p-4 cursor-move hover:shadow-md transition-shadow ${stageColors[candidate.stage]}`}>
      <h4 className="font-medium mb-2 text-[#172B4D]">{candidate.name}</h4>
      <div className="space-y-1 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4" />
          <span>{candidate.email}</span>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4" />
          <span>{candidate.phone}</span>
        </div>
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          <a
            href={candidate.resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Resume
          </a>
        </div>
      </div>
      {candidate.notes && (
        <p className="mt-2 text-sm text-gray-600 line-clamp-2">{candidate.notes}</p>
      )}
      <div className="mt-2 text-xs text-gray-400">
        Added by: {candidate.recruiterUsername}
      </div>
    </Card>
  );
}