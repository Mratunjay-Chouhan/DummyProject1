import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Plus, LogOut, Trash2 } from "lucide-react";
import JobModal from "@/components/job-modal";
import CandidateModal from "@/components/candidate-modal";
import KanbanBoard from "@/components/kanban-board";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Job } from "@shared/schema";

export default function Dashboard() {
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showCandidateModal, setShowCandidateModal] = useState(false);
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/reset");
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "All data has been cleared" });
    },
    onError: () => {
      toast({ 
        title: "Failed to clear data", 
        description: "Only managers can clear data",
        variant: "destructive" 
      });
    },
  });

  const handleExport = async () => {
    if (!selectedJobId) return;
    window.location.href = `/api/jobs/${selectedJobId}/export`;
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] p-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-[#172B4D] text-2xl font-semibold">Recruitment Board</h1>
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setShowJobModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Job
            </Button>
            <Button variant="outline" onClick={() => setShowCandidateModal(true)} disabled={!selectedJobId}>
              <Plus className="w-4 h-4 mr-2" />
              Add Candidate
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={!selectedJobId}>
              <FileDown className="w-4 h-4 mr-2" />
              Export
            </Button>
            {user?.role === "manager" && (
              <Button 
                variant="outline" 
                onClick={() => resetMutation.mutate()}
                className="text-red-500 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Data
              </Button>
            )}
            <Button variant="outline" onClick={() => logout()}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <Select
            value={selectedJobId?.toString() || ""}
            onValueChange={(value) => setSelectedJobId(parseInt(value))}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a job requirement" />
            </SelectTrigger>
            <SelectContent>
              {jobs?.map((job) => (
                <SelectItem key={job.id} value={job.id.toString()}>
                  {job.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedJobId && <KanbanBoard jobId={selectedJobId} />}

        <JobModal open={showJobModal} onOpenChange={setShowJobModal} />
        {selectedJobId && (
          <CandidateModal
            open={showCandidateModal}
            onOpenChange={setShowCandidateModal}
            jobId={selectedJobId}
          />
        )}
      </div>
    </div>
  );
}