"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsContent() {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6">
      <Card className="border-2 border-orange-600">
        <CardHeader>
          <CardTitle className="text-orange-700">Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div>
              <Label htmlFor="password">New Password</Label>
              <Input id="password" type="password" placeholder="••••••••" />
            </div>
            <div>
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input id="confirm" type="password" placeholder="••••••••" />
            </div>
            <div className="flex justify-end">
              <Button className="border-2 border-orange-600 text-orange-700" variant="outline">Reset Password</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
