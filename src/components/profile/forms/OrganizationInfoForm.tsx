"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OrganizationInfoForm() {
  return (
    <form className="space-y-3">
      <h3 className="font-semibold text-orange-700">Organization</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="org">Organization Name</Label>
          <Input id="org" defaultValue="Freddy's Family Pharmacy" />
        </div>
        <div>
          <Label htmlFor="npi">NPI</Label>
          <Input id="npi" defaultValue="1928374650" />
        </div>
        <div>
          <Label htmlFor="dea">DEA</Label>
          <Input id="dea" defaultValue="AB1234567" />
        </div>
      </div>
      <div className="flex justify-end">
        <Button className="border-2 border-orange-600 text-orange-700" variant="outline">Save</Button>
      </div>
    </form>
  );
}
