"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PersonalInfoForm from "./forms/PersonalInfoForm";
import ContactInfoForm from "./forms/ContactInfoForm";
import OrganizationInfoForm from "./forms/OrganizationInfoForm";

export default function ProfileContent() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
      <Card className="border-2 border-orange-600">
        <CardHeader>
          <CardTitle className="text-orange-700">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <PersonalInfoForm />
          <ContactInfoForm />
          <OrganizationInfoForm />
        </CardContent>
      </Card>
    </div>
  );
}
