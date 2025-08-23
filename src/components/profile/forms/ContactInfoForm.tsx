"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ContactInfoForm() {
  return (
    <form className="space-y-3">
      <h3 className="font-semibold text-orange-700">Contact Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" defaultValue="frank@example.com" />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" defaultValue="(555) 123-4567" />
        </div>
        <div>
          <Label htmlFor="altPhone">Alt. Phone</Label>
          <Input id="altPhone" defaultValue="(555) 987-6543" />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="address">Address</Label>
          <Input id="address" defaultValue="1600 Pennsylvania Ave NW" />
        </div>
        <div>
          <Label htmlFor="city">City</Label>
          <Input id="city" defaultValue="Washington" />
        </div>
        <div>
          <Label htmlFor="state">State</Label>
          <Input id="state" defaultValue="DC" />
        </div>
        <div>
          <Label htmlFor="zip">ZIP</Label>
          <Input id="zip" defaultValue="20500" />
        </div>
      </div>
      <div className="flex justify-end">
        <Button className="border-2 border-orange-600 text-orange-700" variant="outline">Save</Button>
      </div>
    </form>
  );
}
