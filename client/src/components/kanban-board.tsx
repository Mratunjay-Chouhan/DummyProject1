import { useQuery, useMutation } from "@tanstack/react-query";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { Card } from "@/components/ui/card";
import CandidateCard from "./candidate-card";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Candidate } from "@shared/schema";
import { stages } from "@shared/schema";

interface KanbanBoardProps {
  jobId: number;
}

export default function KanbanBoard({ jobId }: KanbanBoardProps) {
  const { data: candidates, isLoading } = useQuery<Candidate[]>({
    queryKey: [`/api/jobs/${jobId}/candidates`],
  });

  const mutation = useMutation({
    mutationFn: async ({ id, stage }: { id: number; stage: string }) => {
      await apiRequest("PATCH", `/api/candidates/${id}/stage`, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/candidates`] });
    },
  });

  const onDragEnd = (result: any) => {
    if (!result.destination) return;

    const candidateId = parseInt(result.draggableId);
    const newStage = result.destination.droppableId;

    mutation.mutate({ id: candidateId, stage: newStage });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stages.map((stage) => (
          <div key={stage} className="min-h-[500px]">
            <Card className="p-4 h-full bg-white">
              <h3 className="font-medium mb-4 text-[#172B4D]">{stage}</h3>
              <Droppable droppableId={stage}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2"
                  >
                    {candidates
                      ?.filter((c) => c.stage === stage)
                      .map((candidate, index) => (
                        <Draggable
                          key={candidate.id}
                          draggableId={candidate.id.toString()}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <CandidateCard candidate={candidate} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </Card>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
