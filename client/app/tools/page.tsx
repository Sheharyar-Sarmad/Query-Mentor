"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, Terminal, Wand2 } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LearnTab } from "@/components/sql-tools/learn-tab";
import { ChatTab } from "@/components/sql-tools/chat-tab";
import { SqlConsole } from "@/components/sql-tools/sql-console";

const TABS = [
  { value: "console", label: "SQL Console", icon: Terminal },
  { value: "learn", label: "Learn SQL", icon: Wand2 },
  { value: "chat", label: "Chat", icon: MessageSquare },
];

export default function ToolsPage() {
  const [activeTab, setActiveTab] = useState("console");

  return (
    // overflow-x-hidden on the absolute root container prevents ANY horizontal scroll
    <div className="w-full max-w-full overflow-x-hidden space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full"
      >
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          SQL Tools
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Write, simulate, and understand SQL — all in one place.
        </p>
      </motion.div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full flex flex-col min-w-0"
      >
        {/* Removed the tricky calc() width. Standard -mx margins work perfectly */}
        <div className="sticky top-14 z-30 -mx-4 border-b border-border bg-background/80 px-4 backdrop-blur md:-mx-8 md:px-8">
          <TabsList className="h-12 w-full justify-start gap-1 rounded-none border-0 bg-transparent p-0 overflow-x-auto overflow-y-hidden">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="relative h-12 shrink-0 gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 py-0 text-sm data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="w-full min-w-0 pt-6"
          >
            {activeTab === "console" && (
              <TabsContent
                value="console"
                className="w-full min-w-0 m-0 outline-none"
              >
                <SqlConsole />
              </TabsContent>
            )}
            {activeTab === "learn" && (
              <TabsContent
                value="learn"
                className="w-full min-w-0 m-0 outline-none"
              >
                <LearnTab />
              </TabsContent>
            )}
            {activeTab === "chat" && (
              <TabsContent
                value="chat"
                className="w-full min-w-0 m-0 outline-none"
              >
                <ChatTab />
              </TabsContent>
            )}
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </div>
  );
}