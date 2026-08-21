import { useCallback, useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { flexRender, useTable } from "@tanstack/react-table";
import { features, type Features } from "@/lib/table";
import { api, type RunSummary, type RunDetail } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { CheckCircle, AlertCircle } from "lucide-react";

interface RunHistoryTableProps {
  refreshTrigger?: number;
}

export function RunHistoryTable({ refreshTrigger = 0 }: RunHistoryTableProps) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunDetail, setSelectedRunDetail] = useState<RunDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Declared before the effect that calls it: as a `const` further down it was
  // only reachable because effects run after render, and the effect could not
  // list it as a dependency. useCallback keeps the identity stable so naming it
  // as one does not re-fetch on every render.
  const loadRuns = useCallback(async () => {
    setIsLoading(true);
    try {
      const runsData = await api.getRuns();
      setRuns(runsData);
    } catch (e) {
      console.error("Failed to load runs:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // `loadRuns` flips `isLoading` synchronously, which is exactly what
    // set-state-in-effect warns about. Here the extra render pass is the point:
    // it is what puts the button into its "Refreshing..." state while a parent
    // bumps `refreshTrigger` after a run finishes. Suppressed rather than
    // restructured because the alternatives either drop that feedback or move
    // the flag to the call sites, which the trigger path has none of.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRuns();
  }, [refreshTrigger, loadRuns]);

  const viewRunDetail = async (runId: string) => {
    try {
      const detail = await api.getRun(runId);
      setSelectedRunDetail(detail);
    } catch (e) {
      console.error("Failed to load run detail:", e);
    }
  };

  const columns: ColumnDef<Features, RunSummary>[] = [
    {
      accessorKey: "timestamp",
      header: "Time",
      cell: ({ row }) => {
        const isoString = row.getValue("timestamp") as string;
        return new Date(isoString).toLocaleString();
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as "success" | "error";
        return (
          <div className="flex items-center gap-2">
            {status === "success" ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-600 font-medium">Success</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-red-600 font-medium">Error</span>
              </>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "pdf_created",
      header: "New PDFs",
      cell: ({ row }) => {
        const pdfCreated = row.getValue("pdf_created") as boolean;
        return pdfCreated ? (
          <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
            New PDF
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-muted-foreground">
            Existing
          </Badge>
        );
      },
    },
    {
      accessorKey: "profiles",
      header: "Profiles",
      cell: ({ row }) => {
        const profiles = row.getValue("profiles") as string[];
        return (
          <div className="flex flex-wrap gap-1">
            {profiles.map((profile) => (
              <span
                key={profile}
                className="inline-block px-2 py-1 bg-muted text-xs rounded"
              >
                {profile}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          onClick={() => viewRunDetail(row.original.id)}
          variant="outline"
          size="sm"
        >
          View Logs
        </Button>
      ),
    },
  ];

  const table = useTable({
    features,
    data: runs,
    columns,
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Run History</span>
            <Button onClick={loadRuns} disabled={isLoading} variant="outline" size="sm">
              {isLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No runs yet</p>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        return (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No runs yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {runs.length > 10 && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                Page {table.state.pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </div>
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        table.previousPage();
                      }}
                      className={!table.getCanPreviousPage() ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        table.nextPage();
                      }}
                      className={!table.getCanNextPage() ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedRunDetail && (
        <Dialog open={!!selectedRunDetail} onOpenChange={() => setSelectedRunDetail(null)}>
          <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle className="text-lg">Run Logs - {new Date(selectedRunDetail.timestamp).toLocaleString()}</DialogTitle>
            </DialogHeader>

            <div className="overflow-y-auto flex-1 space-y-3 pr-4">
              {Object.entries(selectedRunDetail.logs).map(([profileName, messages]) => (
                <Card key={profileName} className="border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{profileName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-1.5 font-mono bg-muted/50 p-3 rounded max-h-80 overflow-y-auto">
                      {[...messages].reverse().map((msg, i) => (
                        <div
                          key={i}
                          className={`${
                            msg.status === "error"
                              ? "text-red-600"
                              : msg.status === "success"
                              ? "text-green-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          <span className="font-semibold">[{msg.stage}]</span> {msg.message}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
