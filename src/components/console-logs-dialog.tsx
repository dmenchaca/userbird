import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { XCircle, AlertTriangle, Info, Search, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

interface ConsoleLog {
  level: string;
  message: string;
  timestamp: number;
  stack?: string;
}

interface ConsoleLogsDialogProps {
  logs: ConsoleLog[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConsoleLogsDialog({
  logs,
  open,
  onOpenChange,
}: ConsoleLogsDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  // Reset expanded logs when dialog opens
  useEffect(() => {
    if (open) {
      setExpandedLogs(new Set());
      setSearchQuery("");
    }
  }, [open]);

  // Filter logs based on search query
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    
    const query = searchQuery.toLowerCase();
    return logs.filter(
      (log) =>
        log.message.toLowerCase().includes(query) ||
        log.level.toLowerCase().includes(query) ||
        (log.stack && log.stack.toLowerCase().includes(query))
    );
  }, [logs, searchQuery]);

  // Toggle expanded state of a log
  const toggleLogExpanded = (index: number) => {
    const newExpandedLogs = new Set(expandedLogs);
    if (newExpandedLogs.has(index)) {
      newExpandedLogs.delete(index);
    } else {
      newExpandedLogs.add(index);
    }
    setExpandedLogs(newExpandedLogs);
  };

  // Get icon based on log level
  const getLogIcon = (level: string) => {
    const lowerLevel = level.toLowerCase();
    if (["error", "uncaught", "unhandledrejection"].includes(lowerLevel)) {
      return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
    } else if (lowerLevel === "warn") {
      return <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
    } else {
      return <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    }
  };

  // Format timestamp to readable date/time
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Console Logs</DialogTitle>
          <DialogDescription>
            {logs.length} console log{logs.length !== 1 ? "s" : ""} captured
          </DialogDescription>
        </DialogHeader>

        {/* Search bar */}
        <div className="relative my-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search logs..."
            className="pl-9 pr-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-7 w-7 p-0"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Logs container with vertical scrolling */}
        <div className="overflow-y-auto flex-grow">
          {filteredLogs.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No logs match your search
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log, index) => {
                const isExpanded = expandedLogs.has(index);
                return (
                  <div
                    key={index}
                    className="border rounded-md overflow-hidden"
                  >
                    <div
                      className={`flex items-center gap-2 p-3 cursor-pointer ${
                        ["error", "uncaught", "unhandledrejection"].includes(
                          log.level.toLowerCase()
                        )
                          ? "bg-red-500/10"
                          : log.level.toLowerCase() === "warn"
                          ? "bg-amber-500/10"
                          : "bg-blue-500/10"
                      }`}
                      onClick={() => toggleLogExpanded(index)}
                    >
                      {getLogIcon(log.level)}
                      <div className="flex-grow truncate font-medium">
                        {log.message}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(log.timestamp)}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="p-3 bg-muted/30 border-t">
                        <div className="mb-2">
                          <span className="text-sm font-semibold">Message:</span>
                          <pre className="text-sm whitespace-pre-wrap overflow-x-auto mt-1 p-2 bg-muted rounded">
                            {log.message}
                          </pre>
                        </div>
                        {log.stack && (
                          <div>
                            <span className="text-sm font-semibold">Stack:</span>
                            <pre className="text-sm whitespace-pre-wrap overflow-x-auto mt-1 p-2 bg-muted rounded font-mono text-xs">
                              {log.stack}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 