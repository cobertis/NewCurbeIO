import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, UserPlus } from "lucide-react";

const users = [
  { id: 1, name: "Brandon Ingram", email: "brandon@example.com", role: "Admin", status: "Active" },
  { id: 2, name: "Joe Ingram", email: "joe@example.com", role: "User", status: "Active" },
  { id: 3, name: "Alice Red", email: "alice@example.com", role: "User", status: "Active" },
  { id: 4, name: "Sam Rogers", email: "sam@example.com", role: "Editor", status: "Inactive" },
  { id: 5, name: "Andrew Wiggins", email: "andrew@example.com", role: "User", status: "Active" },
];

export default function Users() {
  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">Users</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Manage your users and their permissions.</p>
        </div>
        <Button data-testid="button-add-user">
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">All Users</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="pl-9"
                data-testid="input-search-users"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                    Name
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                    Email
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                    Role
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider px-6 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    data-testid={`row-user-${user.id}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                          {user.name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{user.role}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.status === "Active"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Button variant="ghost" size="sm" data-testid={`button-edit-user-${user.id}`}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
