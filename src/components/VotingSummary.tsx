import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VoteRecord } from "@/types/governance";
import { Download } from "lucide-react";
import { exportToJSON, exportToMarkdown, exportToCSV, downloadFile } from "@/lib/exportRationales";
import { useState } from "react";

interface VotingSummaryProps {
  votes: VoteRecord[];
  proposalTitle?: string;
}

export function VotingSummary({ votes, proposalTitle = "Proposal" }: VotingSummaryProps) {
  const [downloadFormat, setDownloadFormat] = useState<string>("");

  const handleExport = (format: "json" | "markdown" | "csv") => {
    const sanitizedTitle = proposalTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const timestamp = new Date().toISOString().split("T")[0];
    
    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case "json":
        content = exportToJSON(votes, proposalTitle);
        filename = `voting-rationales-${sanitizedTitle}-${timestamp}.json`;
        mimeType = "application/json";
        break;
      case "markdown":
        content = exportToMarkdown(votes, proposalTitle);
        filename = `voting-rationales-${sanitizedTitle}-${timestamp}.md`;
        mimeType = "text/markdown";
        break;
      case "csv":
        content = exportToCSV(votes, proposalTitle);
        filename = `voting-rationales-${sanitizedTitle}-${timestamp}.csv`;
        mimeType = "text/csv";
        break;
    }

    downloadFile(content, filename, mimeType);
    // Reset select after download
    setTimeout(() => setDownloadFormat(""), 100);
  };

  const voteStats = {
    total: votes.length,
    yes: votes.filter((v) => v.vote === "Yes").length,
    no: votes.filter((v) => v.vote === "No").length,
    abstain: votes.filter((v) => v.vote === "Abstain").length,
  };

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Voting Records</h2>
          <p className="text-muted-foreground">Summary of votes and rationales</p>
        </div>
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-muted-foreground" />
          <Select value={downloadFormat} onValueChange={(value) => handleExport(value as "json" | "markdown" | "csv")}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Download rationales" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">Download as JSON</SelectItem>
              <SelectItem value="markdown">Download as Markdown</SelectItem>
              <SelectItem value="csv">Download as CSV</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{voteStats.total}</div>
          <div className="text-sm text-muted-foreground">Total Votes</div>
        </Card>
        <Card className="p-4 border-border">
          <div className="text-2xl font-bold">{voteStats.yes}</div>
          <div className="text-sm text-muted-foreground">Yes Votes</div>
        </Card>
        <Card className="p-4 border-border">
          <div className="text-2xl font-bold">{voteStats.no}</div>
          <div className="text-sm text-muted-foreground">No Votes</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{voteStats.abstain}</div>
          <div className="text-sm text-muted-foreground">Abstain</div>
        </Card>
      </div>
    </Card>
  );
}

