import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plane } from "lucide-react";

interface UpdateSectionProps {
  onUpdate: () => void;
}

export function UpdateSection({ onUpdate }: UpdateSectionProps) {
  const handleClick = async () => {
    await api.triggerUpdate();
    onUpdate();
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <Button onClick={handleClick} size="lg" className="w-full py-6 text-lg">
          <Plane className="mr-3 h-6 w-6" />
          Download Latest AIP Charts
        </Button>
      </CardContent>
    </Card>
  );
}
