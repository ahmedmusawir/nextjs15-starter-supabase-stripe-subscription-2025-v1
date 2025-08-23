"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PersonalInfoForm() {
  return (
    <form className="space-y-3">
      <h3 className="font-semibold text-orange-700">Personal Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name</Label>
          <Input id="firstName" defaultValue="Frank" />
        </div>
        <div>
          <Label htmlFor="lastName">Last Name</Label>
          <Input id="lastName" defaultValue="Underwood" />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" defaultValue="Pharmacist In Charge" />
        </div>
      </div>
      <div className="flex justify-end">
        <Button className="border-2 border-orange-600 text-orange-700" variant="outline">Save</Button>
      </div>
    </form>
  );
}
